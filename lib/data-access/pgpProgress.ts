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
}

export async function getLatestPgpProgress(
  client: SupabaseClient,
  projectId: string,
): Promise<LatestPgpProgress | null> {
  const { data, error } = await client
    .from("latest_pgp_project_progress")
    .select(
      "nup, progress_percent, expected_progress_percent, deviation_pp, model_version, service_estimate_date, operative_estimate_date, observed_at, source_url",
    )
    .eq("project_id", projectId)
    .maybeSingle();
  // Allows application deployment before the additive migration is applied.
  if (error?.code === "42P01" || error?.code === "PGRST205") return null;
  if (error) throw new Error(`Error obteniendo avance PGP: ${error.message}`);
  if (!data) return null;
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
  };
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
    .select(
      "project_id, nup, progress_percent, expected_progress_percent, deviation_pp, model_version, service_estimate_date, operative_estimate_date, observed_at, source_url",
    )
    .in("project_id", projectIds);
  if (error?.code === "42P01" || error?.code === "PGRST205") return result;
  if (error) throw new Error(`Error obteniendo avance PGP: ${error.message}`);
  for (const row of data ?? []) {
    result.set(row.project_id as string, {
      nup: row.nup as string,
      progressPercent: Number(row.progress_percent),
      observedAt: row.observed_at as string,
      sourceUrl: row.source_url as string,
      expectedProgressPercent: row.expected_progress_percent === null ? null : Number(row.expected_progress_percent),
      deviationPp: row.deviation_pp === null ? null : Number(row.deviation_pp),
      modelVersion: row.model_version as string | null,
      serviceEstimateDate: row.service_estimate_date as string | null,
      operativeEstimateDate: row.operative_estimate_date as string | null,
    });
  }
  return result;
}
