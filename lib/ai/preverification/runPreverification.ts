import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { extname, join } from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  getProjectById,
  REJECTED_STATUSES,
  startOfCurrentMonthIso,
} from "@/lib/data-access/projects";
import {
  downloadDocument,
  findFormularioDocuments,
  findPreliminaryConnectionAuthorizationReports,
  listDocumentsForSolicitud,
  type AccesoAbiertoDocument,
} from "@/lib/ingestion/sources/energia-abierta/detalle-formulario/fetchFromPortal";
import { parseFormulario } from "@/lib/ingestion/sources/energia-abierta/detalle-formulario";
import { loadFormularioResult } from "@/lib/ingestion/sources/energia-abierta/detalle-formulario/load";
import { TECHNOLOGY_COMBOS } from "@/app/(public)/admin/technologyCombos";
import { assessProjectDocuments, extractPdfText } from "./analyze";
import { suggestSeiaMatch } from "./seiaSuggestion";
import type {
  PreverificationFieldResult,
  ProjectPreverificationReport,
} from "./types";

export interface RunPreverificationOptions {
  limit: number;
  concurrency?: number;
  apply: boolean;
  persist: boolean;
  projectIds?: string[];
  editorialOnly?: boolean;
}

function field(
  name: string,
  previousValue: unknown,
  proposedValue: unknown,
  confidence: "high" | "medium" | "low" | null,
  source: string | null,
  reason: string,
): PreverificationFieldResult {
  if (previousValue !== null && previousValue !== undefined && previousValue !== "") {
    return { field: name, status: "already_present", previousValue, proposedValue, applied: false, confidence, source, reason: "El campo ya tenía valor; no se tocó." };
  }
  if (proposedValue === null || proposedValue === undefined) {
    return { field: name, status: "undetermined", previousValue, proposedValue: null, applied: false, confidence, source, reason };
  }
  if (confidence !== "high") {
    return { field: name, status: "suggested_only", previousValue, proposedValue, applied: false, confidence, source, reason };
  }
  return { field: name, status: "completed", previousValue, proposedValue, applied: false, confidence, source, reason };
}

async function downloadToTemp(doc: AccesoAbiertoDocument, directory: string): Promise<string> {
  const path = join(directory, `${doc.id}${extname(doc.nombre) || ".pdf"}`);
  await writeFile(path, await downloadDocument(doc));
  return path;
}

async function atomicFillProjectField(
  client: SupabaseClient,
  projectId: string,
  column: string,
  value: unknown,
): Promise<boolean> {
  // La condición is(null) hace que la regla fill-only sea atómica incluso si un
  // humano completa el campo mientras corre el análisis documental.
  const { data, error } = await client
    .from("project")
    .update({ [column]: value })
    .eq("id", projectId)
    .is(column, null)
    .is("verified_at", null)
    .select("id");
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) === 1;
}

/**
 * Exportada además de usarse internamente en runProjectPreverification: el fix
 * al sync de listado (2026-08-09, ver load.ts) evita que se vuelva a borrar un
 * campo ya calculado, pero no restaura lo que el sync ya borró antes del fix —
 * esta función es re-invocable de forma segura (guardas atómicas is-null) sobre
 * los fields{} ya guardados en project_preverification.report, sin necesidad de
 * volver a llamar al proveedor de IA, para restaurar ese backlog puntualmente.
 */
export async function applyHighConfidenceFields(
  client: SupabaseClient,
  projectId: string,
  fields: PreverificationFieldResult[],
): Promise<void> {
  const byName = new Map(fields.map((result) => [result.field, result]));
  const techField = byName.get("technologyCombo");
  if (techField?.status === "completed" && typeof techField.proposedValue === "string") {
    const combo = techField.proposedValue as keyof typeof TECHNOLOGY_COMBOS;
    const config = TECHNOLOGY_COMBOS[combo];
    const { data: technology, error } = await client.from("technology").select("id").eq("code", config.technologyCode).single();
    if (error) throw new Error(error.message);
    const { data, error: updateError } = await client
      .from("project")
      .update({
        technology_id: technology.id,
        includes_storage: config.includesStorage,
        project_kind: config.projectKind,
      })
      .eq("id", projectId)
      .is("technology_id", null)
      .is("verified_at", null)
      .select("id");
    if (updateError) throw new Error(updateError.message);
    techField.applied = (data?.length ?? 0) === 1;
    if (!techField.applied) {
      techField.status = "already_present";
      techField.reason = "No se aplicó: el campo fue completado o el proyecto fue verificado durante la corrida.";
    }
  }

  const mappings: Array<[string, string]> = [
    ["capacityMw", "capacity_mw"],
    ["storageHours", "storage_hours"],
    ["capacityMwh", "capacity_mwh"],
  ];
  for (const [fieldName, column] of mappings) {
    const result = byName.get(fieldName);
    if (result?.status !== "completed") continue;
    result.applied = await atomicFillProjectField(client, projectId, column, result.proposedValue);
    if (!result.applied) {
      result.status = "already_present";
      result.reason = "No se aplicó: el campo fue completado o el proyecto fue verificado durante la corrida.";
    } else if (fieldName === "capacityMw") {
      // Conserva la compatibilidad establecida por updateProjectField sin
      // sobrescribir generation_capacity_mw si ya existe.
      await atomicFillProjectField(client, projectId, "generation_capacity_mw", result.proposedValue);
    }
  }
}

async function getPendingProjectIds(client: SupabaseClient, limit: number, editorialOnly = false): Promise<string[]> {
  // Rollout operativo: únicamente la cola vigente del Verificador. Se analizan
  // también fichas cuyos campos principales ya están completos porque todavía
  // pueden aportar contactos, evidencia y una sugerencia SEIA.
  let data: Array<{ id: string }> | null = null;
  let error: { message: string } | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    let query = client
      .from("project")
      .select("id")
      .is("verified_at", null)
      .not("status", "in", `(${REJECTED_STATUSES.join(",")})`)
      .gte("estimated_connection_date", startOfCurrentMonthIso());
    if (editorialOnly) {
      query = query.eq("editorial_status", "pending").neq("prefilter_status", "out_of_scope");
    }
    const result = await (editorialOnly
      ? query.order("detected_at", { ascending: false, nullsFirst: false })
      : query.order("estimated_connection_date", { ascending: true }))
      .limit(Math.max(limit + 100, limit));
    data = result.data as Array<{ id: string }> | null;
    error = result.error;
    if (!error) break;
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
  }
  if (error) throw new Error(error.message);
  const candidates = (data ?? []).map((row) => row.id as string);
  if (!candidates.length) return [];
  const { data: previouslyApplied, error: previousError } = await client
    .from("project_preverification")
    .select("project_id")
    .eq("mode", "apply")
    .in("status", ["completed", "partial"]);
  if (previousError) throw new Error(previousError.message);
  const excluded = new Set((previouslyApplied ?? []).map((row) => row.project_id as string));
  return candidates.filter((id) => !excluded.has(id)).slice(0, limit);
}

async function persistReport(
  client: SupabaseClient,
  runId: string,
  report: ProjectPreverificationReport,
): Promise<void> {
  const completed = report.fields.some((item) => item.status === "completed" || item.applied);
  const undetermined = report.fields.some((item) => item.status === "undetermined");
  const status = report.errors.length ? "error" : completed && undetermined ? "partial" : "completed";
  const { error } = await client.from("project_preverification").insert({
    project_id: report.projectId,
    run_id: runId,
    mode: report.mode,
    status,
    report,
  });
  if (error) throw new Error(`No se pudo persistir pre-verificación: ${error.message}`);
}

export async function runProjectPreverification(
  client: SupabaseClient,
  projectId: string,
  runId: string,
  options: Pick<RunPreverificationOptions, "apply" | "persist">,
): Promise<ProjectPreverificationReport> {
  const project = await getProjectById(client, projectId);
  if (!project) throw new Error(`Proyecto ${projectId} no encontrado.`);
  const report: ProjectPreverificationReport = {
    projectId, projectName: project.name, solicitudId: project.externalReference,
    mode: options.apply ? "apply" : "dry_run", documents: [], observedDocumentTypes: [],
    fields: [], contacts: { status: "undetermined", found: 0, loaded: 0, source: null, reason: "No analizado." },
    seia: { expedienteId: null, expedienteName: null, confidence: null, reason: "No analizado." },
    errors: [],
  };

  let formularioResult: Awaited<ReturnType<typeof parseFormulario>> | null = null;
  let preliminaryText: string | null = null;
  const tempDirectory = await mkdtemp(join(tmpdir(), "transition-preverify-"));
  try {
    if (!project.externalReference) {
      report.errors.push("El proyecto no tiene external_reference/solicitud_id.");
    } else {
      const docs = await listDocumentsForSolicitud(project.externalReference);
      report.observedDocumentTypes = [...new Set(docs.map((doc) => doc.tipoDocumento))].sort();
      const formulario = findFormularioDocuments(docs).sort((a, b) => b.id - a.id)[0] ?? null;
      const preliminary = findPreliminaryConnectionAuthorizationReports(docs).sort((a, b) => b.id - a.id)[0] ?? null;

      if (formulario) {
        report.documents.push({ id: formulario.id, name: formulario.nombre, type: formulario.tipoDocumento, role: "formulario" });
        const path = await downloadToTemp(formulario, tempDirectory);
        formularioResult = await parseFormulario(path);
      }
      if (preliminary) {
        report.documents.push({ id: preliminary.id, name: preliminary.nombre, type: preliminary.tipoDocumento, role: "informe_preliminar" });
        const path = await downloadToTemp(preliminary, tempDirectory);
        preliminaryText = await extractPdfText(path);
        if (!preliminaryText) report.errors.push(`Informe preliminar ${preliminary.nombre}: formato sin extracción de texto soportada.`);
      }
    }

    const assessment = await assessProjectDocuments(formularioResult, preliminaryText);
    const source = report.documents.map((doc) => `${doc.role}: ${doc.name}`).join("; ") || null;
    report.fields = [
      field("technologyCombo", project.technologyCode, assessment.technologyCombo, assessment.technologyConfidence, source, assessment.technologyReason),
      field("capacityMw", project.capacityMw, assessment.capacityMw, assessment.capacityMwConfidence, source, assessment.evidence),
      field("storageHours", project.storageHours, assessment.storageHours, assessment.storageHoursConfidence, source, assessment.evidence),
      field("capacityMwh", project.capacityMwh, assessment.capacityMwh, assessment.capacityMwhConfidence, source, assessment.evidence),
    ];

    if (formularioResult?.kind === "full") {
      const found = formularioResult.data.contacts.filter((contact) => contact.name).length;
      report.contacts = {
        status: found ? (options.apply ? "completed" : "suggested_only") : "undetermined",
        found, loaded: 0, source: report.documents.find((doc) => doc.role === "formulario")?.name ?? null,
        reason: found ? "Contactos extraídos; la carga aplica las validaciones vigentes de nombre/email/teléfono." : "El Formulario no entregó contactos plausibles.",
      };
      if (options.apply && found) {
        const loaded = await loadFormularioResult(client, projectId, formularioResult, { enrichProject: false });
        report.contacts.loaded = loaded.personIds.length;
        report.contacts.status = loaded.personIds.length ? "completed" : "undetermined";
      }
    } else {
      report.contacts.reason = formularioResult ? "El documento es solo un checklist de verificación, sin contactos completos." : "No se encontró un Formulario analizable.";
    }

    report.seia = await suggestSeiaMatch(project, assessment);
    if (options.apply) await applyHighConfidenceFields(client, projectId, report.fields);
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : String(error));
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
  if (options.persist) await persistReport(client, runId, report);
  return report;
}

export async function runPreverificationBatch(
  client: SupabaseClient,
  options: RunPreverificationOptions,
): Promise<{ runId: string; reports: ProjectPreverificationReport[] }> {
  const runId = randomUUID();
  const projectIds = options.projectIds?.length
    ? options.projectIds.slice(0, options.limit)
    : await getPendingProjectIds(client, options.limit, options.editorialOnly);
  const reports: ProjectPreverificationReport[] = new Array(projectIds.length);
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 1, 5));
  let nextIndex = 0;
  async function worker(workerNumber: number): Promise<void> {
    while (true) {
      const index = nextIndex++;
      if (index >= projectIds.length) return;
      const projectId = projectIds[index];
      console.log(`[worker ${workerNumber}] [preverification ${index + 1}/${projectIds.length}] ${projectId}: iniciando`);
      try {
        const report = await runProjectPreverification(client, projectId, runId, options);
        reports[index] = report;
        console.log(
          `[worker ${workerNumber}] [preverification ${index + 1}/${projectIds.length}] ${report.projectName}: ${
            report.errors.length ? "con errores" : "completado"
          }`,
        );
      } catch (error) {
        // Un fallo de red antes de construir/persistir el reporte no debe matar
        // los otros trabajadores. El proyecto queda sin registro exitoso y será
        // elegible en la siguiente reanudación.
        console.error(
          `[worker ${workerNumber}] [preverification ${index + 1}/${projectIds.length}] ${projectId}: fallo no persistido: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, projectIds.length) }, (_, index) => worker(index + 1)));
  return { runId, reports: reports.filter((report): report is ProjectPreverificationReport => !!report) };
}
