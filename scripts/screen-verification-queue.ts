// scripts/screen-verification-queue.ts
//
// Registra en `cron_run_log` con el mismo nombre de job que usaba la ruta de
// Vercel (`screen-queue`), para que /admin/operacion vea una sola historia
// continua del tamizado y no dos mitades según dónde corrió.
//
// Por qué importa que registre: desde que los jobs se mudaron al VPS este
// script corre a diario dentro de run-syncs.ps1, pero era uno de los dos del
// set diario que no escribía ninguna fila. Un job que no registra no aparece
// en el panel ni corriendo ni fallando — es exactamente cómo
// `daily-project-report` estuvo fallando sin que nadie se enterara.
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runScreeningQueue } from "../lib/ai/screening/runScreeningQueue";
import { createSupabaseServiceClient } from "../lib/data-access/supabase-service-client";
import { finishCronRun, startCronRun } from "../lib/data-access/cronRunLog";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const JOB_NAME = "screen-queue";
const BATCH_SIZE = Number(process.argv[2] ?? "50");

async function main() {
  const client = createSupabaseServiceClient();
  const run = await startCronRun(client, JOB_NAME);
  try {
    console.log(`Tamizando hasta ${BATCH_SIZE} proyectos pendientes...`);
    const summary = await runScreeningQueue(client, BATCH_SIZE);
    console.log(`Proyectos pendientes de tamizar en esta corrida: ${summary.pending}.`);
    console.log("\n--- Resumen ---");
    console.log("Tamizados:", summary.screened);
    console.log("Sospechosos:", summary.sospechosos);
    console.log("Con candidato SEIA sugerido:", summary.conPick);
    console.log("Errores:", summary.errors);

    await finishCronRun(client, run, {
      status: "success",
      batch_size: summary.pending,
      processed_in_cycle: summary.screened,
      // La ruta de Vercel no guardaba esto y los errores de tamizado quedaban
      // solo en el metadata. Van a su columna para que el panel los sume.
      events_failed: summary.errors,
      metadata: summary,
    });
  } catch (err) {
    await finishCronRun(client, run, { status: "error", error_message: (err as Error).message || "Error sin mensaje" });
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
