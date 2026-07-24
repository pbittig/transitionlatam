// Sincroniza el listado de solicitudes directo desde la API de Acceso Abierto
// (ver lib/ingestion/sources/energia-abierta/listado/fetchFromApi.ts) — sin
// depender de un Excel descargado a mano. Detecta proyectos nuevos y
// actualiza el estado de los existentes (loadNormalizedProjects ya distingue
// creados vs actualizados por external_reference).
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { fetchSolicitudesFromApi, normalizeApiRow } from "../lib/ingestion/sources/energia-abierta/listado/fetchFromApi";
import { loadNormalizedProjects } from "../lib/ingestion/sources/energia-abierta/listado/load";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

async function main() {
  console.log("Descargando listado desde Acceso Abierto...");
  const rawRows = await fetchSolicitudesFromApi();
  console.log(`Solicitudes recibidas: ${rawRows.length}`);

  const normalized = rawRows.map(normalizeApiRow);

  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const summary = await loadNormalizedProjects(client, normalized);

  console.log("\n--- Resumen de carga ---");
  console.log("Filas totales:                     ", summary.totalRows);
  console.log("Proyectos creados:                 ", summary.projectsCreated);
  console.log("Proyectos actualizados (backfill):  ", summary.projectsUpdated);
  console.log("Empresas creadas:                   ", summary.companiesCreated);
  console.log("Ubicaciones creadas:                ", summary.locationsCreated);
  console.log("Estados nuevos:                     ", summary.connectionStatusesCreated);
  console.log("Eventos fallidos:                   ", summary.eventsFailed);
  if (summary.unmatchedRegions.size > 0) {
    console.log("Regiones sin match:                 ", [...summary.unmatchedRegions].join(", "));
  }
  if (summary.unmatchedTechnologies.size > 0) {
    console.log("Tecnologías sin map:                ", [...summary.unmatchedTechnologies].join(", "));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
