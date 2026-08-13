import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { fetchAllEmpresas } from "../lib/ingestion/sources/sipub/empresas/fetch";
import { normalizeEmpresa } from "../lib/ingestion/sources/sipub/empresas/normalize";
import { loadEmpresas } from "../lib/ingestion/sources/sipub/empresas/load";
import { finishCronRun, startCronRun } from "../lib/data-access/cronRunLog";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

// Nunca tuvo ruta de cron en Vercel: corre desde run-syncs.ps1 -Set weekly.
// Registra igual que los demás para que /admin/operacion muestre el pipeline
// completo y no solo la parte que alguna vez vivió en Vercel.
const JOB_NAME = "sync-sipub-empresas";

async function main() {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const run = await startCronRun(client, JOB_NAME);
  try {
    console.log("Descargando empresas coordinadas desde SIPUB...");
    const raw = await fetchAllEmpresas();
    console.log(`Empresas descargadas: ${raw.length}`);

    const normalized = raw.map(normalizeEmpresa);

    const summary = await loadEmpresas(client, normalized);

    console.log("\n--- Resumen ---");
    console.log("Total filas:      ", summary.totalRows);
    console.log("Cargadas/actualizadas:", summary.upserted);

    const grupos = new Set(normalized.filter((e) => e.grupo !== null).map((e) => e.grupo));
    console.log("Grupos corporativos distintos:", grupos.size);

    await finishCronRun(client, run, {
      status: "success",
      eligible_rows: summary.totalRows,
      projects_updated: summary.upserted,
      metadata: { ...summary, gruposDistintos: grupos.size },
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
