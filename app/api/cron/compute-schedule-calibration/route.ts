import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { finishCronRun, startCronRun } from "@/lib/data-access/cronRunLog";
import { computeScheduleCalibration } from "@/lib/analytics/scheduleCalibration";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const client = createSupabaseServiceClient();
  const run = await startCronRun(client, "compute-schedule-calibration", "scheduled");
  try {
    const summary = await computeScheduleCalibration(client);
    await finishCronRun(client, run, { status: "success", metadata: summary });
    return Response.json({ success: true, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishCronRun(client, run, { status: "error", error_message: message });
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
