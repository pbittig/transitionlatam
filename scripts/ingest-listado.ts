import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { parseSolicitudesFile } from "../lib/ingestion/sources/energia-abierta/listado/parse";
import { normalizeRow } from "../lib/ingestion/sources/energia-abierta/listado/normalize";
import { loadNormalizedProjects } from "../lib/ingestion/sources/energia-abierta/listado/load";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

async function main() {
  const filePath = process.argv[2] ?? join(__dirname, "..", "dataset", "solicitudes_muestra.xlsx");
  console.log(`Leyendo ${filePath}...`);

  const rawRows = await parseSolicitudesFile(filePath);
  console.log(`Filas parseadas: ${rawRows.length}`);

  const normalized = rawRows.map(normalizeRow);

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const summary = await loadNormalizedProjects(client, normalized);

  console.log("\n--- Resumen de carga ---");
  console.log("Filas totales:        ", summary.totalRows);
  console.log("Proyectos creados:    ", summary.projectsCreated);
  console.log("Proyectos actualizados (backfill):", summary.projectsUpdated);
  console.log("Empresas creadas:     ", summary.companiesCreated);
  console.log("Ubicaciones creadas:  ", summary.locationsCreated);
  console.log("Estados nuevos:       ", summary.connectionStatusesCreated);
  if (summary.unmatchedRegions.size > 0) {
    console.log("Regiones sin match:   ", [...summary.unmatchedRegions].join(", "));
  }
  if (summary.unmatchedTechnologies.size > 0) {
    console.log("Tecnologías sin map:  ", [...summary.unmatchedTechnologies].join(", "));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
