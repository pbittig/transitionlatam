import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { runPreverificationBatch } from "@/lib/ai/preverification/runPreverification";
import { finishCronRun, startCronRun } from "@/lib/data-access/cronRunLog";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const client = createSupabaseServiceClient();
  const run = await startCronRun(client, "preverify-editorial", "scheduled");
  try {
    process.env.PREVERIFICATION_REVIEW_PROVIDER = "nemotron";
    const result = await runPreverificationBatch(client, {
      limit: 10,
      concurrency: 2,
      apply: true,
      persist: true,
      editorialOnly: true,
    });
    const errors = result.reports.reduce((sum, report) => sum + report.errors.length, 0);
    // Si el lote tenía ítems y TODOS fallaron, no es un "success" — es
    // exactamente el fallo silencioso que dejó el modelo de NVIDIA dado de baja
    // (410 Gone) sin detectar durante semanas: el cron seguía completando sin
    // lanzar, así que cron_run_log decía "success" aunque no se procesara nada.
    const loteFallidoCompleto = result.reports.length > 0 && errors >= result.reports.length;
    const primerError = result.reports.flatMap((r) => r.errors)[0];
    await finishCronRun(client, run, {
      status: loteFallidoCompleto ? "error" : "success",
      batch_size: result.reports.length,
      events_failed: errors,
      metadata: { runId: result.runId },
      ...(loteFallidoCompleto
        ? { error_message: `Los ${result.reports.length} ítems del lote fallaron. Ejemplo: ${primerError ?? "(sin detalle)"}` }
        : {}),
    });
    return Response.json({
      success: true,
      runId: result.runId,
      projects: result.reports.length,
      errors,
    });
  } catch (error) {
    await finishCronRun(client, run, {
      status: "error",
      error_message: (error as Error).message || "Error sin mensaje",
    });
    console.error("[cron/preverify-editorial] error:", error);
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
