import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import { runPreverificationBatch } from "../lib/ai/preverification/runPreverification";
import { finishCronRun, startCronRun } from "../lib/data-access/cronRunLog";
import type { ProjectPreverificationReport } from "../lib/ai/preverification/types";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
config({ path: join(scriptDirectory, "..", ".env.local") });

const args = new Set(process.argv.slice(2));
const valueAfter = (flag: string) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const limit = Number(valueAfter("--limit") ?? "12");
const concurrency = Number(valueAfter("--concurrency") ?? "1");
const provider = valueAfter("--provider") ?? "glm";
if (provider !== "glm" && provider !== "nemotron") {
  throw new Error("--provider debe ser glm o nemotron.");
}
process.env.PREVERIFICATION_REVIEW_PROVIDER = provider;
const apply = args.has("--apply");
const persist = args.has("--persist");
const editorialOnly = args.has("--editorial-only");
const output = resolve(valueAfter("--output") ?? join("docs", `preverification-demo-${new Date().toISOString().slice(0, 10)}.md`));

const serviceRoleFetch: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  if (headers.get("authorization")?.startsWith("Bearer sb_secret_")) {
    headers.delete("authorization");
  }
  return fetch(input, { ...init, headers });
};

function renderReport(runId: string, reports: ProjectPreverificationReport[]): string {
  const lines = [
    "# Demo de pre-verificación con IA",
    "",
    `- Run ID: \`${runId}\``,
    `- Modo: ${reports[0]?.mode ?? "sin proyectos"}`,
    `- Proyectos: ${reports.length}`,
    "",
  ];
  for (const report of reports) {
    lines.push(`## ${report.projectName}`, "", `- Project ID: \`${report.projectId}\``, `- Solicitud: ${report.solicitudId ?? "no disponible"}`);
    lines.push(`- Documentos: ${report.documents.map((doc) => `${doc.role} — ${doc.name} (${doc.type})`).join("; ") || "ninguno"}`);
    lines.push("", "| Campo | Estado | Anterior | Propuesto | Aplicado | Confianza | Fuente / motivo |", "|---|---|---:|---:|---|---|---|");
    for (const item of report.fields) {
      lines.push(`| ${item.field} | ${item.status} | ${item.previousValue ?? "—"} | ${item.proposedValue ?? "—"} | ${item.applied ? "sí" : "no"} | ${item.confidence ?? "—"} | ${(item.source ? `${item.source}. ` : "") + item.reason} |`);
    }
    lines.push("", `- Contactos: ${report.contacts.status}; encontrados ${report.contacts.found}, cargados ${report.contacts.loaded}. ${report.contacts.reason}`);
    lines.push(`- SEIA sugerido: ${report.seia.expedienteId ? `${report.seia.expedienteId} — ${report.seia.expedienteName ?? ""}` : "ninguno"} (${report.seia.confidence ?? "sin confianza"}). ${report.seia.reason}`);
    if (report.errors.length) lines.push(`- Errores: ${report.errors.join("; ")}`);
    lines.push("");
  }
  return lines.join("\n");
}

// Corriendo con --apply, este script ES el job diario de pre-verificación —
// el mismo trabajo que hacía la ruta de Vercel, así que registra bajo su
// nombre y /admin/operacion ve una sola historia continua.
//
// Sin --apply corre en simulación: gasta los mismos ~10 min de IA pero no
// escribe ningún campo. Esa corrida se registra aparte, con nombre propio.
// Anotarla como `preverify-editorial` dejaría el panel diciendo "correcto,
// hace 5 min" por una pasada que no aplicó nada — la clase de mentira que
// justifica que el panel exista. Misma convención que `sync-listado-local`.
const JOB_NAME = apply ? "preverify-editorial" : "preverify-editorial-simulacion";

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  }
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    global: { fetch: serviceRoleFetch },
  });
  const run = await startCronRun(client, JOB_NAME);
  try {
    const result = await runPreverificationBatch(client, { limit, concurrency, apply, persist, editorialOnly });
    await writeFile(output, renderReport(result.runId, result.reports), "utf8");
    const appliedFields = result.reports.flatMap((report) => report.fields).filter((field) => field.applied).length;
    const errors = result.reports.reduce((sum, report) => sum + report.errors.length, 0);
    console.log(JSON.stringify({
      runId: result.runId,
      mode: apply ? "apply" : "dry_run",
      projects: result.reports.length,
      concurrency,
      provider,
      appliedFields,
      errors,
      output,
    }, null, 2));

    await finishCronRun(client, run, {
      status: "success",
      batch_size: result.reports.length,
      events_failed: errors,
      metadata: { runId: result.runId, mode: apply ? "apply" : "dry_run", provider, concurrency, limit, appliedFields },
    });
  } catch (error) {
    await finishCronRun(client, run, { status: "error", error_message: (error as Error).message || "Error sin mensaje" });
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
