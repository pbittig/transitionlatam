import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { fetchAllCentrales } from "../lib/ingestion/sources/sipub/centrales/fetch";
import { normalizeCentral } from "../lib/ingestion/sources/sipub/centrales/normalize";
import { loadCentrales } from "../lib/ingestion/sources/sipub/centrales/load";
import { finishCronRun, startCronRun } from "../lib/data-access/cronRunLog";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

// Ver la cabecera de sync-sipub-empresas.ts: sin ruta en Vercel, semanal
// desde el VPS, y registra igual que el resto del pipeline.
const JOB_NAME = "sync-sipub-centrales";

async function main() {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const run = await startCronRun(client, JOB_NAME);
  try {
    console.log("Descargando centrales desde SIPUB...");
    const raw = await fetchAllCentrales();
    console.log(`Centrales descargadas: ${raw.length}`);

    const normalized = raw.map(normalizeCentral);

    const summary = await loadCentrales(client, normalized);

    console.log("\n--- Resumen ---");
    console.log("Total filas:      ", summary.totalRows);
    console.log("Cargadas/actualizadas:", summary.upserted);
    console.log("Omitidas por estar ya en la CNE:", summary.omitidasPorDuplicado);

    const withCoords = normalized.filter((c) => c.latitude !== null).length;
    const hidden = normalized.filter((c) => c.isHidden).length;
    console.log("Con coordenadas:  ", withCoords);
    console.log("Ocultas (NO_MOSTRAR):", hidden);

    await finishCronRun(client, run, {
      status: "success",
      eligible_rows: summary.totalRows,
      projects_updated: summary.upserted,
      metadata: { ...summary, conCoordenadas: withCoords, ocultas: hidden },
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
