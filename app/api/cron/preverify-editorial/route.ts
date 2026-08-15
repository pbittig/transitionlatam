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
    await finishCronRun(client, run, {
      status: "success",
      batch_size: result.reports.length,
      events_failed: errors,
      metadata: { runId: result.runId },
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
