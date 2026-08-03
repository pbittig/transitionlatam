import type { SupabaseClient } from "@supabase/supabase-js";

export type CronRunStatus = "running" | "success" | "error";

export interface CronRunLog {
  id: number;
  jobName: string;
  status: CronRunStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  batchSize: number | null;
  eligibleRows: number | null;
  processedInCycle: number | null;
  remainingRows: number | null;
  priorityNewRows: number | null;
  projectsCreated: number | null;
  projectsUpdated: number | null;
  requestsDiscarded: number | null;
  cycleComplete: boolean | null;
  errorMessage: string | null;
}

export async function startCronRun(client: SupabaseClient, jobName: string): Promise<{ id: number; startedAt: number }> {
  const startedAt = Date.now();
  const { data, error } = await client
    .from("cron_run_log")
    .insert({ job_name: jobName, status: "running", started_at: new Date(startedAt).toISOString() })
    .select("id")
    .single();
  if (error || !data) throw new Error(`No se pudo iniciar el log del cron: ${error?.message}`);
  return { id: data.id as number, startedAt };
}

export async function finishCronRun(
  client: SupabaseClient,
  run: { id: number; startedAt: number },
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await client
    .from("cron_run_log")
    .update({
      ...patch,
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - run.startedAt,
    })
    .eq("id", run.id);
  if (error) console.error("[cron-log] no se pudo cerrar la ejecución:", error.message);
}

export async function listCronRuns(client: SupabaseClient, limit = 100): Promise<CronRunLog[]> {
  const { data, error } = await client
    .from("cron_run_log")
    .select(
      "id,job_name,status,started_at,finished_at,duration_ms,batch_size,eligible_rows,processed_in_cycle,remaining_rows,priority_new_rows,projects_created,projects_updated,requests_discarded,cycle_complete,error_message",
    )
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`No se pudieron cargar los logs de cron: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id as number,
    jobName: row.job_name as string,
    status: row.status as CronRunStatus,
    startedAt: row.started_at as string,
    finishedAt: (row.finished_at as string | null) ?? null,
    durationMs: (row.duration_ms as number | null) ?? null,
    batchSize: (row.batch_size as number | null) ?? null,
    eligibleRows: (row.eligible_rows as number | null) ?? null,
    processedInCycle: (row.processed_in_cycle as number | null) ?? null,
    remainingRows: (row.remaining_rows as number | null) ?? null,
    priorityNewRows: (row.priority_new_rows as number | null) ?? null,
    projectsCreated: (row.projects_created as number | null) ?? null,
    projectsUpdated: (row.projects_updated as number | null) ?? null,
    requestsDiscarded: (row.requests_discarded as number | null) ?? null,
    cycleComplete: (row.cycle_complete as boolean | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
  }));
}
