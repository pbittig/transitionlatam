import { runPertinenciaSync } from "@/lib/ingestion/sources/sea-pertinencia/runSync";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { finishCronRun, startCronRun } from "@/lib/data-access/cronRunLog";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron real (Vercel Cron, ver vercel.json) — Consultas de Pertinencia SEA.
 * Solo pide detalle completo de lo nuevo/cambiado (ver runSync.ts), así que
 * a diferencia de sync-listado no necesita batching por lotes — el volumen
 * relevante (BESS/renovables) es ~350 filas, no ~2700.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const client = createSupabaseServiceClient();
  const run = await startCronRun(client, "sync-sea-pertinencia", "scheduled");
  try {
    const summary = await runPertinenciaSync(client);
    await finishCronRun(client, run, {
      status: "success",
      eligible_rows: summary.relevantes,
      processed_in_cycle: summary.detalleConsultado,
      projects_created: summary.created,
      projects_updated: summary.updated,
      cycle_complete: true,
    });
    return Response.json({ success: true, ...summary });
  } catch (err) {
    await finishCronRun(client, run, { status: "error", error_message: (err as Error).message || "Error sin mensaje" });
    console.error("[cron/sync-sea-pertinencia] error:", err);
    return Response.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
