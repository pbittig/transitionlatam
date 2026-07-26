"use server";

import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { listDocumentsForSolicitud, getSignedDocumentUrl } from "@/lib/ingestion/sources/energia-abierta/detalle-formulario/fetchFromPortal";

export interface FormularioDocumentLinkResult {
  success: boolean;
  url?: string;
  filename?: string;
  error?: string;
}

/**
 * Devuelve una URL S3 firmada (expira en ~30s) para abrir el documento
 * Formulario original de un proyecto — deja que el admin cotejar el dato
 * extraído por Nemotron contra la fuente sin salir de la ficha. Se pide bajo
 * demanda (no se guarda ni se cachea, la URL firmada expira igual).
 */
export async function getFormularioDocumentLink(projectId: string): Promise<FormularioDocumentLinkResult> {
  if (!(await isAdmin())) {
    return { success: false, error: "Debes iniciar sesión como administrador." };
  }

  try {
    const client = createSupabaseServiceClient();
    const { data: log, error: logError } = await client
      .from("formulario_ingest_log")
      .select("solicitud_id, document_id, status")
      .eq("project_id", projectId)
      .maybeSingle();
    if (logError) throw new Error(logError.message);
    if (!log || log.status !== "success" || !log.document_id) {
      return { success: false, error: "Sin documento de Formulario disponible para este proyecto." };
    }

    const docs = await listDocumentsForSolicitud(log.solicitud_id as string);
    const doc = docs.find((d) => d.id === log.document_id);
    if (!doc) {
      return { success: false, error: "El documento ya no está disponible en Acceso Abierto." };
    }

    const url = await getSignedDocumentUrl(doc);
    return { success: true, url, filename: doc.nombre };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
