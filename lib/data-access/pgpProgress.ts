import type { SupabaseClient } from "@supabase/supabase-js";

export interface LatestPgpProgress {
  nup: string;
  progressPercent: number;
  observedAt: string;
  sourceUrl: string;
  expectedProgressPercent: number | null;
  deviationPp: number | null;
  modelVersion: string | null;
  serviceEstimateDate: string | null;
  operativeEstimateDate: string | null;
  /** Hitos que el expediente PGP tiene registrados — ver 20260812000001_pgp_reported_milestones.sql. */
  receptionDate: string | null;
  constructionDeclarationDate: string | null;
  serviceDate: string | null;
  operativeDate: string | null;
  /** Descripción técnica redactada en el expediente; mejor que cualquier resumen generado por nosotros. */
  description: string | null;
}

const LATEST_PGP_SELECT =
  "nup, progress_percent, expected_progress_percent, deviation_pp, model_version, service_estimate_date, " +
  "operative_estimate_date, observed_at, source_url, reception_date, construction_declaration_date, " +
  "service_date, operative_date, pgp_description";

/* eslint-disable @typescript-eslint/no-explicit-any -- filas sin Database tipado, mismo criterio que el resto de data-access. */
function mapLatestPgpRow(data: any): LatestPgpProgress {
  return {
    nup: data.nup as string,
    progressPercent: Number(data.progress_percent),
    observedAt: data.observed_at as string,
    sourceUrl: data.source_url as string,
    expectedProgressPercent: data.expected_progress_percent === null ? null : Number(data.expected_progress_percent),
    deviationPp: data.deviation_pp === null ? null : Number(data.deviation_pp),
    modelVersion: data.model_version as string | null,
    serviceEstimateDate: data.service_estimate_date as string | null,
    operativeEstimateDate: data.operative_estimate_date as string | null,
    receptionDate: (data.reception_date ?? null) as string | null,
    constructionDeclarationDate: (data.construction_declaration_date ?? null) as string | null,
    serviceDate: (data.service_date ?? null) as string | null,
    operativeDate: (data.operative_date ?? null) as string | null,
    description: (data.pgp_description ?? null) as string | null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function getLatestPgpProgress(
  client: SupabaseClient,
  projectId: string,
): Promise<LatestPgpProgress | null> {
  const { data, error } = await client
    .from("latest_pgp_project_progress")
    .select(LATEST_PGP_SELECT)
    .eq("project_id", projectId)
    .maybeSingle();
  // Allows application deployment before the additive migration is applied.
  if (error?.code === "42P01" || error?.code === "PGRST205") return null;
  if (error) throw new Error(`Error obteniendo avance PGP: ${error.message}`);
  if (!data) return null;
  return mapLatestPgpRow(data);
}

/** Misma lectura que getLatestPgpProgress pero para una página completa de proyectos en una sola consulta — para tablas de listado. */
export async function getLatestPgpProgressForProjects(
  client: SupabaseClient,
  projectIds: string[],
): Promise<Map<string, LatestPgpProgress>> {
  const result = new Map<string, LatestPgpProgress>();
  if (projectIds.length === 0) return result;
  const { data, error } = await client
    .from("latest_pgp_project_progress")
    .select(`project_id, ${LATEST_PGP_SELECT}`)
    .in("project_id", projectIds);
  if (error?.code === "42P01" || error?.code === "PGRST205") return result;
  if (error) throw new Error(`Error obteniendo avance PGP: ${error.message}`);
  for (const row of data ?? []) {
    result.set(row.project_id as string, mapLatestPgpRow(row));
  }
  return result;
}
