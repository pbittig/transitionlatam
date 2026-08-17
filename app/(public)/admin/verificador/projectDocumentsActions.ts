"use server";

import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import {
  listDocumentsForSolicitud,
  getSignedDocumentUrl,
} from "@/lib/ingestion/sources/energia-abierta/detalle-formulario/fetchFromPortal";

export interface ProjectDocumentItem {
  id: number;
  nombre: string;
  tipoDocumento: string;
  razonSocial: string | null;
}

export interface ProjectDocumentsResult {
  success: boolean;
  solicitudId?: string;
  /** SAC, SUCTD o Fehaciente — el trámite bajo el que está esta solicitud. */
  tipoSolicitud?: string | null;
  /** El estado que la fuente le da hoy a la solicitud. */
  estadoSolicitud?: string | null;
  documentos?: ProjectDocumentItem[];
  error?: string;
}

/**
 * Normaliza el tipo de solicitud a como lo nombra el Coordinador.
 *
 * La fuente emite variantes para el mismo trámite —"SUCT" por SUCTD, "SASC" por
 * SAC, "FEHACIENTES" en plural— y el glosario del sector las trata como el
 * mismo proceso, no como procesos distintos. Se muestran con el nombre con el
 * que uno los busca en el portal.
 */
function nombreTramite(requestType: string | null): string | null {
  if (!requestType) return null;
  const t = requestType.trim().toUpperCase();
  if (t.startsWith("SUCT")) return "SUCTD";
  if (t.startsWith("SASC") || t.startsWith("SAC")) return "SAC";
  if (t.startsWith("FEHACIENTE")) return "Proyecto Fehaciente";
  return requestType;
}

/**
 * Lista todos los documentos que Acceso Abierto tiene para la solicitud de este
 * proyecto — los mismos que salen al buscarlo en la barra de archivos del
 * portal, sin salir de la ficha.
 *
 * Se pide bajo demanda y no se guarda: el portal agrega documentos a medida que
 * avanza el trámite, así que una copia nuestra estaría desactualizada justo
 * cuando importa. Además, `solicitud_id` es el `external_reference` del
 * proyecto, y ese cambia cuando el expediente se traspasa de Fehaciente a
 * SUCTD (ver la regla en listado/load.ts) — leerlo en el momento asegura que
 * los documentos son los del expediente vigente, no los del anterior.
 *
 * NO devuelve URLs: las firmadas de S3 expiran en ~30 segundos, así que una
 * lista con enlaces ya firmados llegaría muerta a la pantalla. Se firma de a
 * uno al hacer clic (ver `getProjectDocumentUrl`).
 */
export async function listProjectDocuments(projectId: string): Promise<ProjectDocumentsResult> {
  if (!(await isAdmin())) {
    return { success: false, error: "Debes iniciar sesión como administrador." };
  }
  try {
    const client = createSupabaseServiceClient();
    const { data: project, error } = await client
      .from("project")
      .select("external_reference, status, connections:project_connection(request_type)")
      .eq("id", projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const solicitudId = project?.external_reference as string | undefined;
    if (!solicitudId) {
      return { success: false, error: "Este proyecto no tiene una solicitud de Acceso Abierto asociada." };
    }
    const conexiones = (project?.connections ?? []) as Array<{ request_type: string | null }>;

    const docs = await listDocumentsForSolicitud(solicitudId);
    return {
      success: true,
      solicitudId,
      tipoSolicitud: nombreTramite(conexiones[0]?.request_type ?? null),
      estadoSolicitud: (project?.status as string | null) ?? null,
      documentos: docs.map((d) => ({
        id: d.id,
        nombre: d.nombre,
        tipoDocumento: d.tipoDocumento,
        razonSocial: d.razonSocial,
      })),
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Firma la URL de un documento en el momento del clic.
 *
 * Se vuelve a pedir la lista para resolver el id en vez de recibir la ruta S3
 * desde el cliente: así el navegador nunca decide qué archivo se firma, y un
 * documento que el portal borró entre la lista y el clic devuelve un error
 * claro en vez de una URL rota.
 */
export async function getProjectDocumentUrl(
  projectId: string,
  documentId: number,
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!(await isAdmin())) {
    return { success: false, error: "Debes iniciar sesión como administrador." };
  }
  try {
    const client = createSupabaseServiceClient();
    const { data: project } = await client.from("project").select("external_reference").eq("id", projectId).maybeSingle();
    const solicitudId = project?.external_reference as string | undefined;
    if (!solicitudId) return { success: false, error: "Este proyecto no tiene solicitud asociada." };

    const doc = (await listDocumentsForSolicitud(solicitudId)).find((d) => d.id === documentId);
    if (!doc) return { success: false, error: "El documento ya no está disponible en Acceso Abierto." };

    // inline: para que el PDF se vea en la pestaña en vez de descargarse y
    // dejarla en blanco. Ver la cabecera de getSignedDocumentUrl.
    return { success: true, url: await getSignedDocumentUrl(doc, { inline: true }) };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
