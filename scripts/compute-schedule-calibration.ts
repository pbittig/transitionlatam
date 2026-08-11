// Recalcula la calibración de cronogramas (desviación real vs. teórica por
// desarrollador/tecnología). Equivalente local del cron de Vercel en
// app/api/cron/compute-schedule-calibration/route.ts — misma función, sin el
// límite de maxDuration=60.
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeScheduleCalibration } from "../lib/analytics/scheduleCalibration";
import { createSupabaseServiceClient } from "../lib/data-access/supabase-service-client";
import { startCronRun, finishCronRun } from "../lib/data-access/cronRunLog";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const JOB_NAME = "compute-schedule-calibration";

async function main() {
  const client = createSupabaseServiceClient();
  const run = await startCronRun(client, JOB_NAME);
  console.log("Recalculando calibración de cronogramas...");
  try {
    const summary = await computeScheduleCalibration(client);

    console.log("\n--- Resumen ---");
    for (const [key, value] of Object.entries(summary)) {
      console.log(`${key}:`, Array.isArray(value) ? value.length : value);
    }

    await finishCronRun(client, run, { status: "success", metadata: summary });
  } catch (err) {
    await finishCronRun(client, run, { status: "error", error_message: (err as Error).message || "Error sin mensaje" });
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
