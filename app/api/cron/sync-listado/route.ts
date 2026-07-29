import { runListadoSync } from "@/lib/ingestion/sources/energia-abierta/listado/runSync";

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

  try {
    const summary = await runListadoSync();
    console.log("[cron/sync-listado] resumen:", {
      totalRows: summary.totalRows,
      projectsCreated: summary.projectsCreated,
      projectsUpdated: summary.projectsUpdated,
      projectsPromotedFromSibling: summary.projectsPromotedFromSibling,
      solicitudesDiscardedAsInferior: summary.solicitudesDiscardedAsInferior,
      skippedNotVigente: summary.skippedNotVigente,
      eventsFailed: summary.eventsFailed,
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
      unmatchedRegions: [...summary.unmatchedRegions],
      unmatchedTechnologies: [...summary.unmatchedTechnologies],
    });
  } catch (err) {
    console.error("[cron/sync-listado] error:", err);
    return Response.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
