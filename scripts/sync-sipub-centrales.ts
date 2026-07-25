import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { fetchAllCentrales } from "../lib/ingestion/sources/sipub/centrales/fetch";
import { normalizeCentral } from "../lib/ingestion/sources/sipub/centrales/normalize";
import { loadCentrales } from "../lib/ingestion/sources/sipub/centrales/load";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

async function main() {
  console.log("Descargando centrales desde SIPUB...");
  const raw = await fetchAllCentrales();
  console.log(`Centrales descargadas: ${raw.length}`);

  const normalized = raw.map(normalizeCentral);

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const summary = await loadCentrales(client, normalized);

  console.log("\n--- Resumen ---");
  console.log("Total filas:      ", summary.totalRows);
  console.log("Cargadas/actualizadas:", summary.upserted);

  const withCoords = normalized.filter((c) => c.latitude !== null).length;
  const hidden = normalized.filter((c) => c.isHidden).length;
  console.log("Con coordenadas:  ", withCoords);
  console.log("Ocultas (NO_MOSTRAR):", hidden);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
