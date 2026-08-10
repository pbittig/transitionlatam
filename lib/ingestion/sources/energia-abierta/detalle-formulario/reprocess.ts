import type { SupabaseClient } from "@supabase/supabase-js";
import { extname, join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, unlink, writeFile } from "node:fs/promises";
import { listDocumentsForSolicitud, downloadDocument, findFormularioDocuments } from "./fetchFromPortal";
import { parseFormulario } from "./index";
import { loadFormularioResult } from "./load";

export interface ReprocessResult {
  success: boolean;
  contactCount?: number;
  error?: string;
}

/**
 * Vuelve a extraer los contactos de un proyecto desde su Formulario original,
 * con la lógica de validación vigente (emailMatchesName, isPlausiblePhone,
 * isPlaceholderContact — ver load.ts). Pensado para llamarse al momento de
 * verificar un proyecto (markProjectVerified en projectEditActions.ts), así
 * cada proyecto que se verifica queda con los contactos frescos sin depender
 * de una corrida manual de scripts/backfill-formulario-contacts.ts. Si el
 * proyecto nunca tuvo un Formulario cargado, no hace nada (no es un error).
 */
export async function reprocessFormularioContacts(client: SupabaseClient, projectId: string): Promise<ReprocessResult> {
  const { data: log, error: logError } = await client
    .from("formulario_ingest_log")
    .select("solicitud_id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (logError) return { success: false, error: logError.message };
  if (!log?.solicitud_id) return { success: true, contactCount: 0 };

  const solicitudId = log.solicitud_id as string;
  try {
    const docs = await listDocumentsForSolicitud(solicitudId);
    const formularios = findFormularioDocuments(docs);
    if (formularios.length === 0) return { success: true, contactCount: 0 };

    const doc = formularios[0];
    const buffer = await downloadDocument(doc);
    const tempDir = await mkdtemp(join(tmpdir(), "formulario-verify-"));
    const tempPath = join(tempDir, `${doc.id}${extname(doc.nombre) || ".pdf"}`);
    await writeFile(tempPath, buffer);
    try {
      const result = await parseFormulario(tempPath);
      const loadResult = await loadFormularioResult(client, projectId, result);
      await client
        .from("formulario_ingest_log")
        .update({ status: "success", document_id: doc.id, error_message: null, processed_at: new Date().toISOString() })
        .eq("project_id", projectId);
      return { success: true, contactCount: loadResult.personIds.length };
    } finally {
      await unlink(tempPath).catch(() => {});
    }
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
