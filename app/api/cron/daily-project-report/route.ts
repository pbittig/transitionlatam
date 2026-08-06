import { sendDailyProjectUpdatesReport } from "@/lib/reports/dailyProjectUpdates";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    return Response.json({ success: true, ...(await sendDailyProjectUpdatesReport()) });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
