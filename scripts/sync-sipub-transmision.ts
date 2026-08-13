import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { fetchAllLineas } from "../lib/ingestion/sources/sipub/lineas/fetch";
import { normalizeLinea } from "../lib/ingestion/sources/sipub/lineas/normalize";
import { loadLineas } from "../lib/ingestion/sources/sipub/lineas/load";
import { fetchAllTransformadores2d } from "../lib/ingestion/sources/sipub/transformadores/fetch";
import { aggregateSubstations } from "../lib/ingestion/sources/sipub/transformadores/normalize";
import { loadSubstations } from "../lib/ingestion/sources/sipub/transformadores/load";
import { finishCronRun, startCronRun } from "../lib/data-access/cronRunLog";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

// Ver la cabecera de sync-sipub-empresas.ts: sin ruta en Vercel, semanal
// desde el VPS, y registra igual que el resto del pipeline.
const JOB_NAME = "sync-sipub-transmision";

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const run = await startCronRun(client, JOB_NAME);
  try {
    console.log("Descargando líneas de transmisión...");
    const rawLineas = await fetchAllLineas();
    console.log(`Líneas descargadas: ${rawLineas.length}`);
    const normalizedLineas = rawLineas.map(normalizeLinea);
    const linesUpserted = await loadLineas(client, normalizedLineas);
    console.log(`Líneas cargadas: ${linesUpserted}`);
    const withVoltage = normalizedLineas.filter((l) => l.voltageKv !== null).length;
    console.log(`Con tensión detectada en el nombre: ${withVoltage}`);

    console.log("\nDescargando transformadores (derivando subestaciones)...");
    const rawTransformers = await fetchAllTransformadores2d();
    console.log(`Transformadores descargados: ${rawTransformers.length}`);
    const substations = aggregateSubstations(rawTransformers);
    console.log(`Subestaciones derivadas: ${substations.length}`);
    const substationsUpserted = await loadSubstations(client, substations);
    console.log(`Subestaciones cargadas: ${substationsUpserted}`);

    await finishCronRun(client, run, {
      status: "success",
      eligible_rows: rawLineas.length + rawTransformers.length,
      projects_updated: linesUpserted + substationsUpserted,
      metadata: {
        lineasDescargadas: rawLineas.length,
        lineasCargadas: linesUpserted,
        conTension: withVoltage,
        transformadoresDescargados: rawTransformers.length,
        subestacionesDerivadas: substations.length,
        subestacionesCargadas: substationsUpserted,
      },
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
