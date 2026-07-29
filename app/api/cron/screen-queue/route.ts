import { runScreeningQueue } from "@/lib/ai/screening/runScreeningQueue";

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

  try {
    const summary = await runScreeningQueue(undefined, 15);
    console.log("[cron/screen-queue] resumen:", summary);
    return Response.json({ success: true, ...summary });
  } catch (err) {
    console.error("[cron/screen-queue] error:", err);
    return Response.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
