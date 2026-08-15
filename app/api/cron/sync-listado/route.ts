import { runListadoSyncBatch } from "@/lib/ingestion/sources/energia-abierta/listado/runSync";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { finishCronRun, startCronRun } from "@/lib/data-access/cronRunLog";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron real (Vercel Cron, ver vercel.json) — reemplaza al scheduling manual del
 * agente que se usaba hasta ahora (ver docs/superpowers/specs/2026-07-24-alertas-y-proyectos-nuevos-design.md).
 * Vercel manda `Authorization: Bearer $CRON_SECRET` automáticamente en cada
 * invocación programada — cualquier otro caller sin ese header se rechaza,
 * para que este endpoint no quede abierto a disparar el sync desde afuera.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const client = createSupabaseServiceClient();
  const run = await startCronRun(client, "sync-listado", "scheduled");
  try {
    const summary = await runListadoSyncBatch(client, 15);
    await finishCronRun(client, run, {
      status: "success",
      batch_size: summary.batchSize,
      eligible_rows: summary.eligibleRows,
      processed_in_cycle: summary.processedInCycle,
      remaining_rows: summary.remainingRows,
      priority_new_rows: summary.priorityNewRows,
      projects_created: summary.projectsCreated,
      projects_updated: summary.projectsUpdated,
      projects_promoted: summary.projectsPromotedFromSibling,
      requests_discarded: summary.solicitudesDiscardedAsInferior,
      events_failed: summary.eventsFailed,
      cycle_complete: summary.cycleComplete,
      next_cursor: summary.nextCursor,
      metadata: { waitingForNextCycle: summary.waitingForNextCycle },
    });
    console.log("[cron/sync-listado] resumen:", {
      totalRows: summary.totalRows,
      projectsCreated: summary.projectsCreated,
      projectsUpdated: summary.projectsUpdated,
      projectsPromotedFromSibling: summary.projectsPromotedFromSibling,
      solicitudesDiscardedAsInferior: summary.solicitudesDiscardedAsInferior,
      skippedNotVigente: summary.skippedNotVigente,
      eventsFailed: summary.eventsFailed,
      batchSize: summary.batchSize,
      eligibleRows: summary.eligibleRows,
      processedInCycle: summary.processedInCycle,
      remainingRows: summary.remainingRows,
      cycleComplete: summary.cycleComplete,
      waitingForNextCycle: summary.waitingForNextCycle,
      priorityNewRows: summary.priorityNewRows,
    });
    return Response.json({
      success: true,
      totalRows: summary.totalRows,
      projectsCreated: summary.projectsCreated,
      projectsUpdated: summary.projectsUpdated,
      projectsPromotedFromSibling: summary.projectsPromotedFromSibling,
      solicitudesDiscardedAsInferior: summary.solicitudesDiscardedAsInferior,
      skippedNotVigente: summary.skippedNotVigente,
      companiesCreated: summary.companiesCreated,
      locationsCreated: summary.locationsCreated,
      connectionStatusesCreated: summary.connectionStatusesCreated,
      eventsFailed: summary.eventsFailed,
      batchSize: summary.batchSize,
      eligibleRows: summary.eligibleRows,
      processedInCycle: summary.processedInCycle,
      remainingRows: summary.remainingRows,
      cycleComplete: summary.cycleComplete,
      cycleStartedAt: summary.cycleStartedAt,
      nextCursor: summary.nextCursor,
      waitingForNextCycle: summary.waitingForNextCycle,
      priorityNewRows: summary.priorityNewRows,
      unmatchedRegions: [...summary.unmatchedRegions],
      unmatchedTechnologies: [...summary.unmatchedTechnologies],
    });
  } catch (err) {
    await finishCronRun(client, run, {
      status: "error",
      error_message: (err as Error).message || "Error sin mensaje",
    });
    console.error("[cron/sync-listado] error:", err);
    return Response.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
