import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchPgpProjectProgress } from "./fetch";
import { isDeclaredConstructionStatus } from "@/lib/shared/pgpProjectProgress";
import { expectedConstructionProgress, PDTE_PROGRESS_MODEL_VERSION } from "@/lib/shared/pgpProjectProgress";
import { computeEstimatedPhase } from "@/lib/shared/computeEstimatedPhase";

export interface PgpSyncSummary {
  pgpRows: number;
  eligibleProjects: number;
  batchSize: number;
  processedInCycle: number;
  remainingProjects: number;
  cycleComplete: boolean;
  nextCursor: string | null;
  matched: number;
  inserted: number;
  unchanged: number;
  unmatchedNups: string[];
  missingPgpNups: string[];
}

function normalizeNup(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

const CURSOR_KEY = "pgp_progress_sync_cursor";

export async function runPgpProgressSync(client: SupabaseClient, batchSize = 20): Promise<PgpSyncSummary> {
  const { data: projects, error: projectsError } = await client
    .from("project")
    .select("id, nup, status, estimated_connection_date, capacity_mw, includes_storage, technology:technology_id(code)")
    .not("nup", "is", null);
  if (projectsError) throw new Error(`Error leyendo proyectos elegibles para PGP: ${projectsError.message}`);

  const projectByNup = new Map<string, {
    id: string;
    nup: string;
    status: string | null;
    estimatedConnectionDate: string | null;
    capacityMw: number | null;
    includesStorage: boolean;
    technologyCode: string | null;
  }>();
  for (const project of projects ?? []) {
    const normalizedStatus = String(project.status ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const eligible = isDeclaredConstructionStatus(project.status as string | null) || normalizedStatus === "proyecto finalizado";
    if (eligible && project.nup) {
      const technology = project.technology as unknown as { code: string } | null;
      projectByNup.set(normalizeNup(project.nup as string), {
        id: project.id as string,
        nup: project.nup as string,
        status: project.status as string | null,
        estimatedConnectionDate: project.estimated_connection_date as string | null,
        capacityMw: project.capacity_mw === null ? null : Number(project.capacity_mw),
        includesStorage: Boolean(project.includes_storage),
        technologyCode: technology?.code ?? null,
      });
    }
  }
  const orderedProjects = [...projectByNup.entries()].sort(([a], [b]) => a.localeCompare(b));
  const { data: cursorRow, error: cursorError } = await client
    .from("app_setting")
    .select("value")
    .eq("key", CURSOR_KEY)
    .maybeSingle();
  if (cursorError) throw new Error(`Error leyendo cursor PGP: ${cursorError.message}`);
  const savedCursor = (cursorRow?.value as { last_nup?: string | null } | null)?.last_nup ?? null;
  const cursorIndex = savedCursor ? orderedProjects.findIndex(([nup]) => nup > savedCursor) : 0;
  const startIndex = cursorIndex < 0 ? 0 : cursorIndex;
  const batch = orderedProjects.slice(startIndex, startIndex + Math.max(1, batchSize));
  const cycleComplete = startIndex + batch.length >= orderedProjects.length;
  const nextCursor = cycleComplete || !batch.length ? null : batch[batch.length - 1][0];
  const batchProjects = new Map(batch);
  const pgpRows = await fetchPgpProjectProgress(batch.map(([, project]) => project.nup));

  const { data: latest, error: latestError } = await client
    .from("latest_pgp_project_progress")
    .select("project_id, progress_percent, observed_at");
  if (latestError) throw new Error(`Error leyendo último avance PGP: ${latestError.message}`);
  const latestByProject = new Map((latest ?? []).map((row) => [row.project_id as string, {
    percent: Number(row.progress_percent),
    observedAt: new Date(row.observed_at as string),
  }]));

  let matched = 0;
  let unchanged = 0;
  const observations: Array<Record<string, unknown>> = [];
  const unmatchedNups: string[] = [];
  const matchedProjectIds = new Set<string>();

  for (const reading of pgpRows) {
    const project = batchProjects.get(normalizeNup(reading.nup));
    if (!project) {
      unmatchedNups.push(reading.nup);
      continue;
    }
    matched++;
    matchedProjectIds.add(project.id);
    const previous = latestByProject.get(project.id);
    const ageDays = previous ? (Date.now() - previous.observedAt.getTime()) / 86_400_000 : Number.POSITIVE_INFINITY;
    // Preserve a weekly heartbeat even without movement; otherwise a project
    // stalled at 0% would have no measurable duration in the history.
    if (previous?.percent === reading.progressPercent && ageDays < 7) {
      unchanged++;
      continue;
    }
    const estimatedPhase = computeEstimatedPhase(
      project.estimatedConnectionDate,
      project.technologyCode,
      project.includesStorage,
      project.capacityMw,
    );
    const constructionStart = estimatedPhase?.milestones.find((milestone) => milestone.phase === "construccion")?.estimatedStartDate ?? null;
    const expectedProgress = constructionStart && project.estimatedConnectionDate
      ? expectedConstructionProgress(constructionStart, project.estimatedConnectionDate)
      : null;
    observations.push({
      project_id: project.id,
      nup: project.nup,
      progress_percent: reading.progressPercent,
      declared_cod_snapshot: project.estimatedConnectionDate,
      project_status_snapshot: project.status,
      expected_progress_percent: expectedProgress,
      deviation_pp: expectedProgress === null ? null : Math.round((reading.progressPercent - expectedProgress) * 100) / 100,
      model_version: expectedProgress === null ? null : PDTE_PROGRESS_MODEL_VERSION,
      source_url: reading.sourceUrl,
      source_payload: reading.raw,
    });
  }

  if (observations.length) {
    const { error } = await client.from("pgp_project_progress_observation").insert(observations);
    if (error) throw new Error(`Error guardando avance PGP: ${error.message}`);
  }

  const { error: cursorSaveError } = await client.from("app_setting").upsert({
    key: CURSOR_KEY,
    value: { last_nup: nextCursor, updated_at: new Date().toISOString() },
    updated_at: new Date().toISOString(),
  });
  if (cursorSaveError) throw new Error(`Error guardando cursor PGP: ${cursorSaveError.message}`);

  return {
    pgpRows: pgpRows.length,
    eligibleProjects: projectByNup.size,
    batchSize: batch.length,
    processedInCycle: startIndex + batch.length,
    remainingProjects: cycleComplete ? 0 : Math.max(0, orderedProjects.length - startIndex - batch.length),
    cycleComplete,
    nextCursor,
    matched,
    inserted: observations.length,
    unchanged,
    unmatchedNups: [...new Set(unmatchedNups)].slice(0, 100),
    missingPgpNups: [...batchProjects.values()]
      .filter((project) => !matchedProjectIds.has(project.id))
      .map((project) => project.nup)
      .slice(0, 100),
  };
}
