import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import type { ProjectPreverificationReport } from "../lib/ai/preverification/types";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
config({ path: join(scriptDirectory, "..", ".env.local") });
const output = resolve(process.argv[2] ?? join("docs", "preverification-demo-2026-07-28.md"));

function render(reports: ProjectPreverificationReport[], runIds: string[]): string {
  const applied = reports.flatMap((report) => report.fields).filter((item) => item.applied);
  const lines = [
    "# Demo de pre-verificación con IA — 12 proyectos",
    "",
    `- Run IDs: ${runIds.map((id) => `\`${id}\``).join(", ")}`,
    `- Proyectos procesados: ${reports.length}`,
    `- Campos completados: ${applied.length}`,
    `- Proyectos marcados verificados por este proceso: 0`,
    "",
  ];
  for (const report of reports) {
    lines.push(`## ${report.projectName}`, "", `- Project ID: \`${report.projectId}\``, `- Solicitud: ${report.solicitudId ?? "no disponible"}`);
    lines.push(`- Documentos: ${report.documents.map((doc) => `${doc.role} — ${doc.name} [${doc.type}]`).join("; ") || "ninguno"}`);
    lines.push(`- Tipos documentales observados: ${report.observedDocumentTypes.join("; ") || "ninguno"}`, "");
    lines.push("| Campo | Estado | Anterior | Propuesto | Aplicado | Confianza | Fuente / motivo |", "|---|---|---:|---:|---|---|---|");
    for (const item of report.fields) {
      lines.push(`| ${item.field} | ${item.status} | ${item.previousValue ?? "—"} | ${item.proposedValue ?? "—"} | ${item.applied ? "sí" : "no"} | ${item.confidence ?? "—"} | ${`${item.source ? `${item.source}. ` : ""}${item.reason}`.replaceAll("|", "\\|")} |`);
    }
    lines.push("", `- Contactos: ${report.contacts.status}; encontrados ${report.contacts.found}, cargados ${report.contacts.loaded}. ${report.contacts.reason}`);
    lines.push(`- SEIA sugerido: ${report.seia.expedienteId ? `${report.seia.expedienteId} — ${report.seia.expedienteName ?? ""}` : "ninguno"} (${report.seia.confidence ?? "sin confianza"}). ${report.seia.reason}`);
    lines.push(`- No determinados/errores: ${report.errors.length ? report.errors.join("; ") : "sin errores técnicos; ver campos con estado undetermined."}`, "");
  }
  return lines.join("\n");
}

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await client
    .from("project_preverification")
    .select("run_id, report, created_at")
    .eq("mode", "apply")
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const reports = rows.map((row) => row.report as ProjectPreverificationReport).reverse();
  const runIds = [...new Set(rows.map((row) => row.run_id as string))];
  const projectIds = reports.map((report) => report.projectId);
  const { data: projects, error: projectError } = await client.from("project").select("id, verified_at").in("id", projectIds);
  if (projectError) throw new Error(projectError.message);
  const unexpectedlyVerified = (projects ?? []).filter((project) => project.verified_at !== null);
  if (unexpectedlyVerified.length) {
    throw new Error(`Control falló: ${unexpectedlyVerified.length} proyectos tienen verified_at no nulo.`);
  }
  await writeFile(output, render(reports, runIds), "utf8");
  console.log(JSON.stringify({
    output,
    projects: reports.length,
    runIds,
    appliedFields: reports.flatMap((report) => report.fields).filter((item) => item.applied).length,
    contactsLoaded: reports.reduce((sum, report) => sum + report.contacts.loaded, 0),
    seiaSuggestions: reports.filter((report) => report.seia.expedienteId).length,
    verifiedAtNonNull: unexpectedlyVerified.length,
    preliminaryDocumentTypes: [...new Set(reports.flatMap((report) => report.documents.filter((doc) => doc.role === "informe_preliminar").map((doc) => doc.type)))],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
