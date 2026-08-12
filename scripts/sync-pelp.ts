// Sincroniza la Planificación Energética de Largo Plazo (PELP) del Ministerio
// de Energía: modelo de expansión del SEN.
//
// Los registros que carga NO son proyectos: son candidatos/resultados de un
// modelo de optimización. Quedan en tablas `pelp_*` con source_type
// 'PELP_MODEL' y no tocan `project`, `company` ni `spv`.
//
// Cadencia sugerida: mensual. El modelo se publica por versión de informe (hoy
// "Informe Preliminar PELP 2028-2032"), no cambia a diario.
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPelpSync } from "../lib/ingestion/sources/pelp/runSync";
import { createSupabaseServiceClient } from "../lib/data-access/supabase-service-client";
import { startCronRun, finishCronRun } from "../lib/data-access/cronRunLog";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const JOB_NAME = "sync-pelp";

async function main() {
  const client = createSupabaseServiceClient();
  const run = await startCronRun(client, JOB_NAME);
  console.log("Descargando modelo de expansión PELP...");
  try {
    const summary = await runPelpSync(client);

    console.log("\n--- Resumen ---");
    console.log("Escenarios:                ", summary.scenarios);
    console.log("Carriers (tecnologías):    ", summary.carriers);
    console.log("Nodos:                     ", summary.nodes);
    console.log("Activos de almacenamiento: ", summary.storageAssets);
    console.log("Filas de expansión leídas: ", summary.expansionRowsFetched);
    console.log("Filas cargadas:            ", summary.expansionRowsUpserted);
    console.log("Filas descartadas:         ", summary.expansionRowsSkipped);

    await finishCronRun(client, run, {
      status: "success",
      eligible_rows: summary.expansionRowsFetched,
      processed_in_cycle: summary.expansionRowsUpserted,
      cycle_complete: true,
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
