// Sincroniza Consultas de Pertinencia del SEA relacionadas con renovables/BESS
// — ver prueba técnica 2026-08-04/05. Corrida manual; el cron real vive en
// app/api/cron/sync-sea-pertinencia/route.ts.
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPertinenciaSync } from "../lib/ingestion/sources/sea-pertinencia/runSync";
import { createSupabaseServiceClient } from "../lib/data-access/supabase-service-client";
import { startCronRun, finishCronRun } from "../lib/data-access/cronRunLog";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const JOB_NAME = "sync-sea-pertinencia";

async function main() {
  const client = createSupabaseServiceClient();
  const run = await startCronRun(client, JOB_NAME);
  console.log("Consultando listado de Pertinencias del SEA...");
  try {
    const summary = await runPertinenciaSync(client);

    console.log("\n--- Resumen ---");
    console.log("Total en el listado del SEA:      ", summary.totalListado);
    console.log("Relevantes (BESS/renovables):     ", summary.relevantes);
    console.log("Con detalle consultado (nuevas/cambiadas):", summary.detalleConsultado);
    console.log("Detalle fallido (se omitió, no rompió el resto):", summary.detalleFallido);
    console.log("Creadas:                          ", summary.created);
    console.log("Actualizadas:                     ", summary.updated);
    console.log("Con match de proyecto sugerido:   ", summary.matchesSuggested);

    await finishCronRun(client, run, {
      status: "success",
      eligible_rows: summary.relevantes,
      processed_in_cycle: summary.detalleConsultado,
      projects_created: summary.created,
      projects_updated: summary.updated,
      cycle_complete: true,
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
