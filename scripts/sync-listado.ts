// Sincroniza el listado de solicitudes directo desde la API de Acceso Abierto
// (ver lib/ingestion/sources/energia-abierta/listado/fetchFromApi.ts) — sin
// depender de un Excel descargado a mano. Detecta proyectos nuevos y
// actualiza el estado de los existentes (loadNormalizedProjects ya distingue
// creados vs actualizados por external_reference).
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runListadoSync } from "../lib/ingestion/sources/energia-abierta/listado/runSync";
import { createSupabaseServiceClient } from "../lib/data-access/supabase-service-client";
import { startCronRun, finishCronRun } from "../lib/data-access/cronRunLog";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

// Job separado de "sync-listado" (el cron real de Vercel, por lotes de 15
// filas) — esta es la corrida local/manual completa, sin límite de lote. Se
// loguea aparte para no confundir el volumen de una con el de la otra en
// /admin/logs, aunque ambas actualicen la misma cartera.
const JOB_NAME = "sync-listado-local";

async function main() {
  const client = createSupabaseServiceClient();
  const run = await startCronRun(client, JOB_NAME);
  console.log("Descargando listado desde Acceso Abierto...");
  try {
    const summary = await runListadoSync(client);

    console.log("\n--- Resumen de carga ---");
    console.log("Filas totales:                     ", summary.totalRows);
    console.log("Proyectos creados:                 ", summary.projectsCreated);
    console.log("Proyectos actualizados (backfill):  ", summary.projectsUpdated);
    console.log("Promovidos desde hermano (Fehaciente/SUCTD):", summary.projectsPromotedFromSibling);
    console.log("Solicitudes descartadas (inferiores):", summary.solicitudesDiscardedAsInferior);
    console.log("Omitidos (no vigentes, etapa posterior): ", summary.skippedNotVigente);
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

    await finishCronRun(client, run, {
      status: "success",
      eligible_rows: summary.totalRows,
      processed_in_cycle: summary.totalRows,
      remaining_rows: 0,
      projects_created: summary.projectsCreated,
      projects_updated: summary.projectsUpdated,
      projects_promoted: summary.projectsPromotedFromSibling,
      requests_discarded: summary.solicitudesDiscardedAsInferior,
      events_failed: summary.eventsFailed,
      cycle_complete: true,
    });
  } catch (err) {
    await finishCronRun(client, run, {
      status: "error",
      error_message: (err as Error).message || "Error sin mensaje",
    });
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
