// Sincroniza el avance físico de obra (PGP) de los proyectos con NUP.
// El cron de Vercel (app/api/cron/sync-pgp-progress/route.ts) está atado a
// maxDuration=60, por eso procesa lotes de 20 y tarda varios días en dar una
// vuelta completa. Acá no existe ese límite: se itera sobre el cursor hasta
// cerrar el ciclo en una sola corrida, y se registra un único cron_run_log
// por pasada completa (no uno por lote) para que /admin/operacion siga
// leyéndose igual que antes.
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPgpProgressSync } from "../lib/ingestion/sources/pgp/runSync";
import { createSupabaseServiceClient } from "../lib/data-access/supabase-service-client";
import { startCronRun, finishCronRun } from "../lib/data-access/cronRunLog";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const JOB_NAME = "sync-pgp-progress";
const BATCH_SIZE = Number(process.argv[2] ?? "100");
/** Tope de seguridad: el ciclo avanza por cursor, esto solo actúa si dejara de avanzar. */
const MAX_ITERATIONS = 200;

async function main() {
  const client = createSupabaseServiceClient();
  const run = await startCronRun(client, JOB_NAME);
  console.log(`Sincronizando avance PGP (lotes de ${BATCH_SIZE}) hasta completar el ciclo...`);
  try {
    let iterations = 0;
    let matched = 0;
    let inserted = 0;
    let unchanged = 0;
    let last: Awaited<ReturnType<typeof runPgpProgressSync>> | null = null;

    while (iterations < MAX_ITERATIONS) {
      const summary = await runPgpProgressSync(client, BATCH_SIZE);
      iterations += 1;
      matched += summary.matched;
      inserted += summary.inserted;
      unchanged += summary.unchanged;
      last = summary;
      console.log(
        `  lote ${iterations}: ${summary.batchSize} proyectos | ` +
          `${summary.processedInCycle}/${summary.eligibleProjects} | restantes ${summary.remainingProjects}`,
      );
      // batchSize 0 significa que no quedó nada por tomar: cortar igual que con
      // cycleComplete, para no quedar girando sobre un cursor que no avanza.
      if (summary.cycleComplete || summary.batchSize === 0) break;
    }

    if (!last) throw new Error("runPgpProgressSync no devolvió ningún resumen.");

    console.log("\n--- Resumen ---");
    console.log("Lotes procesados:                ", iterations);
    console.log("Filas PGP en la fuente:          ", last.pgpRows);
    console.log("Proyectos elegibles (con NUP):   ", last.eligibleProjects);
    console.log("Observaciones nuevas (insertadas):", inserted);
    console.log("Coincidencias con PGP:           ", matched);
    console.log("Sin cambios:                     ", unchanged);
    console.log("NUP sin match en PGP:            ", last.unmatchedNups.length);
    console.log("Ciclo completo:                  ", last.cycleComplete);

    await finishCronRun(client, run, {
      status: "success",
      batch_size: BATCH_SIZE,
      eligible_rows: last.eligibleProjects,
      processed_in_cycle: last.processedInCycle,
      remaining_rows: last.remainingProjects,
      cycle_complete: last.cycleComplete,
      next_cursor: last.nextCursor,
      metadata: { ...last, iterations, matched, inserted, unchanged },
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
