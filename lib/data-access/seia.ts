import type { SupabaseClient } from "@supabase/supabase-js";
import { isConfirmedSeiaMatch } from "@/lib/shared/seiaMatchTrust";

export interface SeiaRecordForProject {
  nombre: string;
  titular: string | null;
  submissionType: string | null; // EIA / DIA
  status: string | null;
  filedAt: string | null;
  investmentAmount: number | null;
  urlFicha: string | null;
  matchConfidence: "alta" | "media" | "baja" | null;
}

/**
 * Igual que getSeiaRecordForProject pero para varios proyectos a la vez — usado
 * en listados (ProjectTable, seguimiento).
 *
 * A diferencia de la versión de un solo proyecto, acá los vínculos sin confirmar
 * se omiten: un listado no tiene espacio para explicar que el expediente es un
 * candidato dudoso, así que mostrarlo ahí lo convierte en un hecho. La ficha sí
 * los muestra, marcados (ver lib/shared/seiaMatchTrust.ts).
 */
export async function getSeiaRecordsForProjects(
  client: SupabaseClient,
  projectIds: string[],
): Promise<Map<string, SeiaRecordForProject>> {
  if (projectIds.length === 0) return new Map();
  const { data, error } = await client
    .from("seia_record")
    .select("project_id, nombre, titular_name, submission_type, status, filed_at, investment_amount, url_ficha, match_confidence")
    .in("project_id", projectIds);
  if (error) throw new Error(`Error leyendo expedientes SEIA: ${error.message}`);

  const map = new Map<string, SeiaRecordForProject>();
  for (const row of data ?? []) {
    if (!isConfirmedSeiaMatch({ matchConfidence: row.match_confidence as "alta" | "media" | "baja" | null })) continue;
    map.set(row.project_id as string, {
      nombre: row.nombre,
      titular: row.titular_name,
      submissionType: row.submission_type,
      status: row.status,
      filedAt: row.filed_at,
      investmentAmount: row.investment_amount,
      urlFicha: row.url_ficha,
      matchConfidence: row.match_confidence as "alta" | "media" | "baja" | null,
    });
  }
  return map;
}

/** Expediente ambiental SEIA vinculado a este proyecto, si ya se encontró un match (ver ADR SEIA). */
export async function getSeiaRecordForProject(client: SupabaseClient, projectId: string): Promise<SeiaRecordForProject | null> {
  const { data, error } = await client
    .from("seia_record")
    .select("nombre, titular_name, submission_type, status, filed_at, investment_amount, url_ficha, match_confidence")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw new Error(`Error leyendo expediente SEIA: ${error.message}`);
  if (!data) return null;
  return {
    nombre: data.nombre,
    titular: data.titular_name,
    submissionType: data.submission_type,
    status: data.status,
    filedAt: data.filed_at,
    investmentAmount: data.investment_amount,
    urlFicha: data.url_ficha,
    matchConfidence: data.match_confidence as "alta" | "media" | "baja" | null,
  };
}
