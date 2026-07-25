import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { fetchAllEmpresas } from "../lib/ingestion/sources/sipub/empresas/fetch";
import { normalizeEmpresa } from "../lib/ingestion/sources/sipub/empresas/normalize";
import { loadEmpresas } from "../lib/ingestion/sources/sipub/empresas/load";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

async function main() {
  console.log("Descargando empresas coordinadas desde SIPUB...");
  const raw = await fetchAllEmpresas();
  console.log(`Empresas descargadas: ${raw.length}`);

  const normalized = raw.map(normalizeEmpresa);

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const summary = await loadEmpresas(client, normalized);

  console.log("\n--- Resumen ---");
  console.log("Total filas:      ", summary.totalRows);
  console.log("Cargadas/actualizadas:", summary.upserted);

  const grupos = new Set(normalized.filter((e) => e.grupo !== null).map((e) => e.grupo));
  console.log("Grupos corporativos distintos:", grupos.size);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
