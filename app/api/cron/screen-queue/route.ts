import { runScreeningQueue } from "@/lib/ai/screening/runScreeningQueue";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { finishCronRun, startCronRun } from "@/lib/data-access/cronRunLog";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron real (Vercel Cron, ver vercel.json) — tamiza con IA + busca candidatos
 * SEIA para proyectos pendientes de verificar. batchSize se mantiene bajo
 * (15 ≈ 15 * ~2s ≈ 30s) para no exceder maxDuration=60 en el plan Hobby —
 * ver runScreeningQueue.ts. Progresa incrementalmente cada día, no procesa
 * toda la cola de una sola corrida.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const client = createSupabaseServiceClient();
  const run = await startCronRun(client, "screen-queue");
  try {
    const summary = await runScreeningQueue(client, 15);
    await finishCronRun(client, run, {
      status: "success",
      batch_size: summary.pending,
      metadata: summary,
    });
    console.log("[cron/screen-queue] resumen:", summary);
    return Response.json({ success: true, ...summary });
  } catch (err) {
    await finishCronRun(client, run, {
      status: "error",
      error_message: (err as Error).message || "Error sin mensaje",
    });
    console.error("[cron/screen-queue] error:", err);
    return Response.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
