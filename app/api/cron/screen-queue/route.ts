import { runScreeningQueue } from "@/lib/ai/screening/runScreeningQueue";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { finishCronRun, startCronRun } from "@/lib/data-access/cronRunLog";

export const dynamic = "force-dynamic";
// 60s alcanzaba cuando el costo asumido era ~2s por proyecto. La sugerencia de
// verificación (GLM, ver lib/ai/provider/glm.ts) en realidad toma ~35-55s por
// llamada — con eso, hasta 2 proyectos ya excedían los 60s y el cron se cortaba
// a mitad de lote sin llegar a loguear el resultado. Se sube a 300, el mismo
// techo que ya usa preverify-editorial en este mismo despliegue.
export const maxDuration = 300;

/**
 * Cron real (Vercel Cron, ver vercel.json) — tamiza con IA + busca candidatos
 * SEIA para proyectos pendientes de verificar. batchSize en 5 porque cada
 * proyecto cuesta ~40-55s (GLM, no ~2s como se asumía originalmente) — ver
 * lib/ai/provider/glm.ts. Progresa incrementalmente cada día, no procesa toda
 * la cola de una sola corrida.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const client = createSupabaseServiceClient();
  const run = await startCronRun(client, "screen-queue", "scheduled");
  try {
    const summary = await runScreeningQueue(client, 5);
    // Mismo criterio que preverify-editorial: si había ítems y todos fallaron,
    // es un "error" real, no un "success" — este cron corrió así, en silencio,
    // durante semanas tras la baja del modelo de NVIDIA (410 Gone) sin que
    // nadie lo notara porque nunca lanzaba.
    const loteFallidoCompleto = summary.pending > 0 && summary.errors >= summary.pending;
    await finishCronRun(client, run, {
      status: loteFallidoCompleto ? "error" : "success",
      batch_size: summary.pending,
      metadata: summary,
      ...(loteFallidoCompleto
        ? { error_message: `Los ${summary.pending} ítems del lote fallaron (screened=${summary.screened}).` }
        : {}),
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
