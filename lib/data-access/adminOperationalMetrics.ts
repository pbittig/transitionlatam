import type { SupabaseClient } from "@supabase/supabase-js";

export type CronRunStatus = "running" | "success" | "error";

export interface LatestJobRun {
  jobName: string;
  status: CronRunStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
}

export interface JobErrorCount {
  jobName: string;
  count: number;
}

export interface AdminOperationalMetrics {
  totalProjects: number;
  verifiedProjects: number;
  editorialPending: number;
  editorialExcluded: number;
  needsReverification: number;
  coverage: {
    seia: number;
    pertinencia: number;
    pgp: number;
    ownership: number;
  };
  latestRunPerJob: LatestJobRun[];
  errorsLast7Days: JobErrorCount[];
}

export async function getAdminOperationalMetrics(client: SupabaseClient): Promise<AdminOperationalMetrics> {
  const { data, error } = await client.rpc("get_admin_operational_metrics");
  if (error) throw new Error(`Error obteniendo métricas operacionales: ${error.message}`);
  return data as AdminOperationalMetrics;
}
