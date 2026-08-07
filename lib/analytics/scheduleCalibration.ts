import type { SupabaseClient } from "@supabase/supabase-js";
import { isDeclaredConstructionStatus } from "@/lib/shared/pgpProjectProgress";

export interface ScheduleCalibrationSummary {
  developersComputed: number;
  sectorCodSlippageSampleSize: number;
  sectorConstructionLagSampleSize: number;
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function daysBetween(earlier: string, later: string): number {
  return (new Date(later).getTime() - new Date(earlier).getTime()) / 86_400_000;
}

/**
 * project_event.previous_value/new_value are jsonb, but some historical rows
 * were inserted as a JSON *string* (double-encoded) rather than an object —
 * a since-fixed bug in the two ingestion sites that write this table. Handles
 * both so the small number of already-collected rows aren't discarded.
 */
function parseEventValue(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof value === "object") return value as Record<string, unknown>;
  return null;
}

/**
 * Recomputes lib/shared "how does reality actually behave" statistics from
 * data already being collected (project_event, pgp_project_progress_observation)
 * — never from projectPhaseDurations.ts, which stays hand-curated. Sample
 * sizes are tiny today; this is designed to self-improve as more projects
 * reach construction and get confirmed in PGP, not to be trusted early. The
 * table is fully replaced on every run — cheap at this data volume, and
 * avoids upsert-key bookkeeping for a table with no natural stable key
 * besides "developer" (which can be null for the sector-wide row).
 */
export async function computeScheduleCalibration(client: SupabaseClient): Promise<ScheduleCalibrationSummary> {
  const [{ data: codEvents, error: codError }, { data: statusEvents, error: statusError }, { data: pgpRows, error: pgpError }] = await Promise.all([
    client.from("project_event").select("project_id, previous_value, new_value").eq("event_type", "connection_date_change"),
    client
      .from("project_event")
      .select("project_id, new_value, occurred_at")
      .eq("event_type", "status_change")
      .order("occurred_at", { ascending: true }),
    client
      .from("pgp_project_progress_observation")
      .select("project_id, progress_percent, observed_at")
      .order("observed_at", { ascending: true }),
  ]);
  if (codError) throw new Error(`Error leyendo eventos de cambio de COD: ${codError.message}`);
  if (statusError) throw new Error(`Error leyendo eventos de cambio de estado: ${statusError.message}`);
  if (pgpError) throw new Error(`Error leyendo observaciones PGP: ${pgpError.message}`);

  const relevantProjectIds = new Set<string>([
    ...(codEvents ?? []).map((e) => e.project_id as string),
    ...(statusEvents ?? []).map((e) => e.project_id as string),
    ...(pgpRows ?? []).map((r) => r.project_id as string),
  ]);
  const { data: projects, error: projectsError } = relevantProjectIds.size
    ? await client.from("project").select("id, developer_company_id").in("id", [...relevantProjectIds])
    : { data: [], error: null };
  if (projectsError) throw new Error(`Error leyendo proyectos: ${projectsError.message}`);
  const developerByProject = new Map((projects ?? []).map((p) => [p.id as string, p.developer_company_id as string | null]));

  // --- COD slippage: days moved per connection_date_change event ---
  const codSlippageByDeveloper = new Map<string | null, number[]>();
  for (const event of codEvents ?? []) {
    const previous = parseEventValue(event.previous_value)?.estimatedConnectionDate as string | undefined;
    const next = parseEventValue(event.new_value)?.estimatedConnectionDate as string | undefined;
    if (!previous || !next) continue;
    const daysMoved = daysBetween(previous, next);
    if (!Number.isFinite(daysMoved)) continue;
    const developerId = developerByProject.get(event.project_id as string) ?? null;
    const bucket = codSlippageByDeveloper.get(developerId) ?? [];
    bucket.push(daysMoved);
    codSlippageByDeveloper.set(developerId, bucket);
  }

  // --- Construction-declared -> first PGP progress lag ---
  const declaredAtByProject = new Map<string, string>();
  for (const event of statusEvents ?? []) {
    const projectId = event.project_id as string;
    if (declaredAtByProject.has(projectId)) continue; // rows are ascending by occurred_at — keep the earliest
    const status = (parseEventValue(event.new_value)?.status as string | undefined) ?? null;
    if (isDeclaredConstructionStatus(status)) declaredAtByProject.set(projectId, event.occurred_at as string);
  }
  const firstProgressAtByProject = new Map<string, string>();
  for (const row of pgpRows ?? []) {
    const projectId = row.project_id as string;
    if (firstProgressAtByProject.has(projectId)) continue; // rows are ascending by observed_at — keep the earliest
    if (Number(row.progress_percent) > 0) firstProgressAtByProject.set(projectId, row.observed_at as string);
  }
  const constructionLagByDeveloper = new Map<string | null, number[]>();
  for (const [projectId, declaredAt] of declaredAtByProject) {
    const firstProgressAt = firstProgressAtByProject.get(projectId);
    if (!firstProgressAt) continue;
    const lagDays = daysBetween(declaredAt, firstProgressAt);
    // Negative would mean PGP progress predates our own "declared en construcción"
    // record — an artifact of when our own tracking started, not a real lag.
    if (!Number.isFinite(lagDays) || lagDays < 0) continue;
    const developerId = developerByProject.get(projectId) ?? null;
    const bucket = constructionLagByDeveloper.get(developerId) ?? [];
    bucket.push(lagDays);
    constructionLagByDeveloper.set(developerId, bucket);
  }

  const developerIds = new Set(
    [...codSlippageByDeveloper.keys(), ...constructionLagByDeveloper.keys()].filter((id): id is string => id !== null),
  );
  const allCodSlippage = [...codSlippageByDeveloper.values()].flat();
  const allConstructionLag = [...constructionLagByDeveloper.values()].flat();

  const rows = [
    {
      developer_company_id: null,
      cod_slippage_days_avg: average(allCodSlippage),
      cod_slippage_sample_size: allCodSlippage.length,
      construction_lag_days_avg: average(allConstructionLag),
      construction_lag_days_median: median(allConstructionLag),
      construction_lag_sample_size: allConstructionLag.length,
    },
    ...[...developerIds].map((developerId) => {
      const codValues = codSlippageByDeveloper.get(developerId) ?? [];
      const lagValues = constructionLagByDeveloper.get(developerId) ?? [];
      return {
        developer_company_id: developerId,
        cod_slippage_days_avg: average(codValues),
        cod_slippage_sample_size: codValues.length,
        construction_lag_days_avg: average(lagValues),
        construction_lag_days_median: median(lagValues),
        construction_lag_sample_size: lagValues.length,
      };
    }),
  ];

  const { error: deleteError } = await client.from("schedule_calibration_stat").delete().not("id", "is", null);
  if (deleteError) throw new Error(`Error limpiando calibración anterior: ${deleteError.message}`);
  const { error: insertError } = await client.from("schedule_calibration_stat").insert(rows);
  if (insertError) throw new Error(`Error guardando calibración: ${insertError.message}`);

  return {
    developersComputed: developerIds.size,
    sectorCodSlippageSampleSize: allCodSlippage.length,
    sectorConstructionLagSampleSize: allConstructionLag.length,
  };
}
