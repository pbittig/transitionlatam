import { sendDailyProjectUpdatesReport } from "@/lib/reports/dailyProjectUpdates";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { finishCronRun, startCronRun } from "@/lib/data-access/cronRunLog";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Hoy el scheduling vive en el VPS (scripts/run-syncs.ps1); esta ruta se
 * mantiene por si se vuelve a programar desde Vercel. Registra en
 * cron_run_log como el resto: era la única que no lo hacía, y por eso sus
 * fallos no aparecían en /admin/operacion.
 */
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const client = createSupabaseServiceClient();
  const run = await startCronRun(client, "daily-project-report", "scheduled");
  try {
    const summary = await sendDailyProjectUpdatesReport();
    // Un envío omitido por falta de RESEND_API_KEY no es un éxito.
    if (!summary.sent) throw new Error("El reporte se generó pero NO se envió: falta RESEND_API_KEY.");
    await finishCronRun(client, run, {
      status: "success",
      eligible_rows: summary.accessOpen + summary.seia,
      cycle_complete: true,
      metadata: summary,
    });
    return Response.json({ success: true, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishCronRun(client, run, { status: "error", error_message: message });
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
