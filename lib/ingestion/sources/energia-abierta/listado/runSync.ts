import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSolicitudesFromApi, normalizeApiRow } from "./fetchFromApi";
import { isVigenteRow, loadNormalizedProjects, type LoadSummary } from "./load";
import { isRenewableOrBessProject } from "./prefilter";
import {
  addPipelineSeenExternalIds,
  clearPipelineSyncCursor,
  getPipelineSyncCursor,
  getPipelineSeenExternalIds,
  recordPipelineSync,
  savePipelineSyncCursor,
} from "@/lib/data-access/pipeline";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";

/**
 * Punto único de la sincronización del listado — usado por scripts/sync-listado.ts
 * (corrida manual) y por app/api/cron/sync-listado/route.ts (cron real de la
 * plataforma de hosting). Nunca dupliques el fetch+load acá, solo invócalo.
 */
export async function runListadoSync(client?: SupabaseClient): Promise<LoadSummary> {
  const supabase = client ?? createSupabaseServiceClient();
  const rawRows = await fetchSolicitudesFromApi();
  const normalized = rawRows.map(normalizeApiRow).filter((row) => isVigenteRow(row) && isRenewableOrBessProject(row));
  const summary = await loadNormalizedProjects(supabase, normalized);
  await recordPipelineSync(supabase);
  await clearPipelineSyncCursor(supabase);
  return summary;
}

export interface ListadoBatchResult extends LoadSummary {
  batchSize: number;
  eligibleRows: number;
  processedInCycle: number;
  remainingRows: number;
  cycleComplete: boolean;
  cycleStartedAt: string;
  nextCursor: string | null;
  waitingForNextCycle: boolean;
  priorityNewRows: number;
}

function compareExternalIds(a: string, b: string): number {
  return a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
}

function emptyLoadSummary(): LoadSummary {
  return {
    totalRows: 0,
    projectsCreated: 0,
    projectsUpdated: 0,
    projectsPromotedFromSibling: 0,
    solicitudesDiscardedAsInferior: 0,
    companiesCreated: 0,
    locationsCreated: 0,
    connectionStatusesCreated: 0,
    eventsFailed: 0,
    skippedNotVigente: 0,
    unmatchedRegions: new Set(),
    unmatchedTechnologies: new Set(),
  };
}

/**
 * Sincronización incremental para funciones con duración limitada. El cursor
 * avanza solo después de que el lote completo termina; repetir un lote tras un
 * corte es seguro porque la carga actualiza por external_reference.
 */
export async function runListadoSyncBatch(
  client?: SupabaseClient,
  batchSize = 15,
): Promise<ListadoBatchResult> {
  const supabase = client ?? createSupabaseServiceClient();
  const storedCursor = await getPipelineSyncCursor(supabase);
  const { data: lastCompleted } = await supabase
    .from("app_setting")
    .select("updated_at")
    .eq("key", "pipeline_last_synced_at")
    .maybeSingle();
  const lastCompletedAt = lastCompleted?.updated_at ? new Date(lastCompleted.updated_at).getTime() : null;
  const hoursSinceCompletion = lastCompletedAt === null ? null : (Date.now() - lastCompletedAt) / 3_600_000;

  const rawRows = await fetchSolicitudesFromApi();
  const eligibleRows = rawRows
    .map(normalizeApiRow)
    .filter((row) => isVigenteRow(row) && isRenewableOrBessProject(row))
    .sort((a, b) => compareExternalIds(a.externalId, b.externalId));

  // Primera prioridad de cada despertar: solicitudes nuevas que todavía no
  // existen en nuestra base. Se recalculan contra la fuente en cada corrida,
  // por lo que no dependen del cursor de actualización de la cartera.
  const existingExternalIds = new Set<string>();
  for (let offset = 0; ; offset += 1000) {
    const { data: page, error } = await supabase
      .from("project")
      .select("external_reference")
      .not("external_reference", "is", null)
      .range(offset, offset + 999);
    if (error) throw new Error(`No se pudo identificar proyectos nuevos: ${error.message}`);
    for (const project of page ?? []) existingExternalIds.add(project.external_reference as string);
    if (!page || page.length < 1000) break;
  }
  const seenExternalIds = await getPipelineSeenExternalIds(supabase);
  const priorityNewRows = eligibleRows.filter(
    (row) => !existingExternalIds.has(row.externalId) && !seenExternalIds.has(row.externalId),
  );
  if (priorityNewRows.length > 0) {
    const priorityBatch = priorityNewRows.slice(0, batchSize);
    const summary = await loadNormalizedProjects(supabase, priorityBatch, { shuffleRows: false });
    await addPipelineSeenExternalIds(
      supabase,
      priorityBatch.map((row) => row.externalId),
    );
    return {
      ...summary,
      batchSize: priorityBatch.length,
      eligibleRows: eligibleRows.length,
      processedInCycle: storedCursor?.processedInCycle ?? 0,
      remainingRows: eligibleRows.length - priorityBatch.length,
      cycleComplete: false,
      cycleStartedAt: storedCursor?.cycleStartedAt ?? new Date().toISOString(),
      nextCursor: storedCursor?.lastExternalId ?? null,
      waitingForNextCycle: false,
      priorityNewRows: priorityNewRows.length,
    };
  }

  // La detección prioritaria de proyectos nuevos siempre ocurre antes de esta
  // pausa entre ciclos de actualización general.
  if (!storedCursor && hoursSinceCompletion !== null && hoursSinceCompletion < 18) {
    return {
      ...emptyLoadSummary(),
      batchSize: 0,
      eligibleRows: eligibleRows.length,
      processedInCycle: 0,
      remainingRows: 0,
      cycleComplete: true,
      cycleStartedAt: lastCompleted!.updated_at as string,
      nextCursor: null,
      waitingForNextCycle: true,
      priorityNewRows: 0,
    };
  }

  const cycleStartedAt = storedCursor?.cycleStartedAt ?? new Date().toISOString();
  const startIndex = storedCursor?.lastExternalId
    ? eligibleRows.findIndex((row) => compareExternalIds(row.externalId, storedCursor.lastExternalId!) > 0)
    : 0;
  const normalizedStartIndex = startIndex === -1 ? eligibleRows.length : startIndex;
  const batch = eligibleRows.slice(normalizedStartIndex, normalizedStartIndex + batchSize);

  if (batch.length === 0) {
    await recordPipelineSync(supabase);
    await clearPipelineSyncCursor(supabase);
    return {
      ...emptyLoadSummary(),
      batchSize: 0,
      eligibleRows: eligibleRows.length,
      processedInCycle: storedCursor?.processedInCycle ?? eligibleRows.length,
      remainingRows: 0,
      cycleComplete: true,
      cycleStartedAt,
      nextCursor: null,
      waitingForNextCycle: false,
      priorityNewRows: 0,
    };
  }

  const summary = await loadNormalizedProjects(supabase, batch, { shuffleRows: false });
  const processedInCycle = (storedCursor?.processedInCycle ?? 0) + batch.length;
  const nextIndex = normalizedStartIndex + batch.length;
  const cycleComplete = nextIndex >= eligibleRows.length;
  const nextCursor = cycleComplete ? null : batch.at(-1)!.externalId;

  if (cycleComplete) {
    await recordPipelineSync(supabase);
    await clearPipelineSyncCursor(supabase);
  } else {
    await savePipelineSyncCursor(supabase, {
      lastExternalId: nextCursor,
      cycleStartedAt,
      processedInCycle,
    });
  }

  return {
    ...summary,
    batchSize: batch.length,
    eligibleRows: eligibleRows.length,
    processedInCycle,
    remainingRows: Math.max(eligibleRows.length - nextIndex, 0),
    cycleComplete,
    cycleStartedAt,
    nextCursor,
    waitingForNextCycle: false,
    priorityNewRows: 0,
  };
}
