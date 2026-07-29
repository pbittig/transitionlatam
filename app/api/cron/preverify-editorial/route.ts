import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { runPreverificationBatch } from "@/lib/ai/preverification/runPreverification";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    process.env.PREVERIFICATION_REVIEW_PROVIDER = "nemotron";
    const result = await runPreverificationBatch(createSupabaseServiceClient(), {
      limit: 10,
      concurrency: 2,
      apply: true,
      persist: true,
      editorialOnly: true,
    });
    return Response.json({
      success: true,
      runId: result.runId,
      projects: result.reports.length,
      errors: result.reports.reduce((sum, report) => sum + report.errors.length, 0),
    });
  } catch (error) {
    console.error("[cron/preverify-editorial] error:", error);
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

