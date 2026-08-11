// Envía el reporte diario de novedades de proyectos.
//
// Registra en cron_run_log como el resto de los jobs. Antes no lo hacía —
// era el único sin registro — y por eso su fallo era invisible en
// /admin/operacion: no aparecía ni corriendo ni fallando.
//
// Si `RESEND_API_KEY` no está configurada, el envío se omite y el job
// termina con exit 1 a propósito. Un reporte que no llega es un fallo, no
// un éxito silencioso.
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sendDailyProjectUpdatesReport } from "../lib/reports/dailyProjectUpdates";
import { createSupabaseServiceClient } from "../lib/data-access/supabase-service-client";
import { startCronRun, finishCronRun } from "../lib/data-access/cronRunLog";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const JOB_NAME = "daily-project-report";

async function main() {
  const since = new Date();
  since.setDate(since.getDate() - 1);
  since.setHours(0, 0, 0, 0);

  const client = createSupabaseServiceClient();
  const run = await startCronRun(client, JOB_NAME);
  console.log(`Generando reporte de novedades desde ${since.toISOString()}...`);
  try {
    const summary = await sendDailyProjectUpdatesReport(since);

    console.log("\n--- Resumen ---");
    console.log("Destinatario:              ", summary.recipient);
    console.log("Cambios de Acceso Abierto: ", summary.accessOpen);
    console.log("Novedades SEIA:            ", summary.seia);
    console.log("Correo enviado:            ", summary.sent);

    if (!summary.sent) {
      throw new Error(
        "El reporte se generó pero NO se envió: falta RESEND_API_KEY en el entorno.",
      );
    }

    await finishCronRun(client, run, {
      status: "success",
      eligible_rows: summary.accessOpen + summary.seia,
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
