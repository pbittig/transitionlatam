import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { finishCronRun, startCronRun } from "@/lib/data-access/cronRunLog";
import { runCneCapacitySync } from "@/lib/ingestion/sources/cne/capacidad/runSync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const client = createSupabaseServiceClient();
  const run = await startCronRun(client, "sync-cne-capacidad", "scheduled");
  try {
    const summary = await runCneCapacitySync(client);
    await finishCronRun(client, run, { status: "success", metadata: summary });
    return Response.json({ success: true, ...summary });
  } catch (error) {
    const message = (error as Error).message || "Error sin mensaje";
    await finishCronRun(client, run, { status: "error", error_message: message });
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
