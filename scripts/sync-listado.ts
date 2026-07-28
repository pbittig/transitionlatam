// Sincroniza el listado de solicitudes directo desde la API de Acceso Abierto
// (ver lib/ingestion/sources/energia-abierta/listado/fetchFromApi.ts) — sin
// depender de un Excel descargado a mano. Detecta proyectos nuevos y
// actualiza el estado de los existentes (loadNormalizedProjects ya distingue
// creados vs actualizados por external_reference).
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runListadoSync } from "../lib/ingestion/sources/energia-abierta/listado/runSync";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

async function main() {
  console.log("Descargando listado desde Acceso Abierto...");
  const summary = await runListadoSync();

  console.log("\n--- Resumen de carga ---");
  console.log("Filas totales:                     ", summary.totalRows);
  console.log("Proyectos creados:                 ", summary.projectsCreated);
  console.log("Proyectos actualizados (backfill):  ", summary.projectsUpdated);
  console.log("Promovidos desde hermano (Fehaciente/SUCTD):", summary.projectsPromotedFromSibling);
  console.log("Solicitudes descartadas (inferiores):", summary.solicitudesDiscardedAsInferior);
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
