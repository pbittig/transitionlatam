// Sincroniza la capacidad instalada de la CNE descargándola de la fuente, que
// es lo mismo que hace el cron en app/api/cron/sync-cne-capacidad/route.ts.
//
// OJO — no confundir con scripts/sync-cne-capacidad.ts, que es el importador
// manual anterior: aquel lee un CSV estático de dataset/ y por lo tanto carga
// lo que hubiera el día que alguien bajó ese archivo. Este descarga la versión
// vigente. Para correr desatendido hay que usar ESTE; el otro quedó como
// herramienta puntual (y tiene anotado en su cabecera el hallazgo pendiente
// sobre la API de Energía Abierta, que sigue vigente).
//
// runCneCapacitySync es idempotente por fecha: si `fecha_act` de la descarga
// coincide con la última carga registrada, no reescribe nada y devuelve
// changed=false.
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCneCapacitySync } from "../lib/ingestion/sources/cne/capacidad/runSync";
import { createSupabaseServiceClient } from "../lib/data-access/supabase-service-client";
import { startCronRun, finishCronRun } from "../lib/data-access/cronRunLog";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const JOB_NAME = "sync-cne-capacidad";

async function main() {
  const client = createSupabaseServiceClient();
  const run = await startCronRun(client, JOB_NAME);
  console.log("Descargando capacidad instalada desde la CNE...");
  try {
    const summary = await runCneCapacitySync(client, { force: process.argv.includes("--force") });

    console.log("\n--- Resumen ---");
    console.log("Fecha de la fuente:  ", summary.sourceDate);
    console.log("Hubo cambios:        ", summary.changed);
    console.log("Centrales:           ", summary.plants);
    console.log("Capacidad total (MW):", summary.totalCapacityMw);
    if (!summary.changed) console.log("(la fuente no cambió desde la última carga — no se reescribió nada)");

    await finishCronRun(client, run, {
      status: "success",
      eligible_rows: summary.plants,
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
