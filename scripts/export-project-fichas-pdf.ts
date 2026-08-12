/**
 * Exporta un PDF con una ficha por proyecto (una página A4 cada una).
 *
 * Por defecto sólo incluye proyectos verificados (`verified_at` no nulo) — son los
 * únicos cuya data ya pasó revisión editorial y por lo tanto los únicos que tiene
 * sentido imprimir en un documento que sale de la plataforma.
 *
 *   npx tsx scripts/export-project-fichas-pdf.ts [--all] [--out <ruta.pdf>]
 *
 * El PDF se arma renderizando HTML y mandándolo a imprimir con el Chromium que ya
 * está instalado en la máquina (Edge o Chrome, `--headless --print-to-pdf`): el
 * proyecto no tiene ninguna librería de escritura de PDF entre sus dependencias y
 * no vale la pena agregar una para un export puntual.
 */
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

config({ path: ".env.local" });

/** Mismo workaround que el resto de los scripts: la key `sb_secret_` no va como Bearer. */
const serviceRoleFetch: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  if (headers.get("authorization")?.startsWith("Bearer sb_secret_")) headers.delete("authorization");
  return fetch(input, { ...init, headers });
};

const PROJECT_SELECT =
  "id, name, internal_code, external_reference, nup, capacity_mw, capacity_mwh, net_injection_mw, net_withdrawal_mw, " +
  "generation_capacity_mw, storage_capacity_mw, storage_hours, includes_storage, status, estimated_connection_date, " +
  "construction_start_date, verified_at, project_kind, " +
  "technology:technology_id(name, code), location:location_id(comuna, region:region_id(name)), country:country_id(code), " +
  "developer:developer_company_id(name, rut, legal_address), spv:spv_id(name), " +
  "project_connection(connection_point, voltage_level, request_type)";

interface ProjectRow {
  id: string;
  name: string;
  internal_code: string;
  external_reference: string | null;
  nup: string | null;
  capacity_mw: number | null;
  capacity_mwh: number | null;
  net_injection_mw: number | null;
  net_withdrawal_mw: number | null;
  generation_capacity_mw: number | null;
  storage_capacity_mw: number | null;
  storage_hours: number | null;
  includes_storage: boolean;
  status: string | null;
  estimated_connection_date: string | null;
  construction_start_date: string | null;
  verified_at: string | null;
  project_kind: string | null;
  technology: { name: string; code: string } | null;
  location: { comuna: string | null; region: { name: string } | null } | null;
  country: { code: string } | null;
  developer: { name: string; rut: string | null; legal_address: string | null } | null;
  spv: { name: string } | null;
  project_connection: Array<{ connection_point: string | null; voltage_level: string | null; request_type: string | null }>;
}

interface SeiaRow {
  project_id: string;
  nombre: string | null;
  titular_name: string | null;
  submission_type: string | null;
  status: string | null;
  filed_at: string | null;
  investment_amount: number | null;
  url_ficha: string | null;
}

interface PertinenciaRow {
  matched_project_id: string;
  name: string | null;
  titular_name: string | null;
  estado: string | null;
  sub_estado: string | null;
  fecha_presentacion: string | null;
  fecha_respuesta: string | null;
}

interface PgpRow {
  project_id: string;
  progress_percent: number | string | null;
  expected_progress_percent: number | string | null;
  deviation_pp: number | string | null;
  observed_at: string | null;
  service_estimate_date: string | null;
  operative_estimate_date: string | null;
}

/** PostgREST corta en 1000 filas por request; se pagina siempre aunque hoy el universo sea menor. */
async function fetchAllProjects(client: SupabaseClient, verifiedOnly: boolean): Promise<ProjectRow[]> {
  const rows: ProjectRow[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    let query = client.from("project").select(PROJECT_SELECT).order("name").range(from, from + pageSize - 1);
    if (verifiedOnly) query = query.not("verified_at", "is", null);
    const { data, error } = await query;
    if (error) throw new Error(`Error leyendo proyectos: ${error.message}`);
    const batch = (data ?? []) as unknown as ProjectRow[];
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
  }
}

/** Los `.in()` con cientos de ids revientan el largo de URL — se consulta por lotes. */
async function fetchByProjectIds<T>(
  client: SupabaseClient,
  table: string,
  select: string,
  column: string,
  ids: string[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- el builder de supabase-js encadena por mutación de tipo; sin un Database tipado no vale la pena reconstruir su firma (mismo criterio que lib/data-access/projects.ts).
  refine?: (query: any) => any,
): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    let query = client.from(table).select(select).in(column, ids.slice(i, i + 100));
    if (refine) query = refine(query);
    const { data, error } = await query;
    // La tabla puede no existir todavía en una base sin la migración aditiva aplicada.
    if (error && (error.code === "42P01" || error.code === "PGRST205")) return rows;
    if (error) throw new Error(`Error leyendo ${table}: ${error.message}`);
    rows.push(...((data ?? []) as unknown as T[]));
  }
  return rows;
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const EMPTY = "—";

/** `project_kind` es un código interno (ver app/(public)/admin/technologyCombos.ts) — no se imprime crudo. */
const PROJECT_KIND_LABELS: Record<string, string> = {
  generation: "Generación",
  storage: "Almacenamiento",
  hybrid: "Híbrido",
};

const projectKindLabel = (kind: string | null): string | null => (kind ? (PROJECT_KIND_LABELS[kind] ?? kind) : null);

function text(value: string | null | undefined): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed === "" ? EMPTY : escapeHtml(trimmed);
}

function num(value: number | string | null | undefined, unit: string, decimals = 1): string {
  if (value === null || value === undefined || value === "") return EMPTY;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return EMPTY;
  return `${parsed.toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: decimals })} ${unit}`;
}

function date(value: string | null | undefined): string {
  if (!value) return EMPTY;
  const iso = value.slice(0, 10);
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return escapeHtml(value);
  return `${d}-${m}-${y}`;
}

function usd(value: number | null | undefined): string {
  if (value === null || value === undefined) return EMPTY;
  return `MMUSD ${Number(value).toLocaleString("es-CL", { maximumFractionDigits: 2 })}`;
}

function field(label: string, value: string): string {
  return `<div class="field"><dt>${escapeHtml(label)}</dt><dd${value === EMPTY ? ' class="empty"' : ""}>${value}</dd></div>`;
}

function section(title: string, fields: string[]): string {
  return `<section><h2>${escapeHtml(title)}</h2><dl class="grid">${fields.join("")}</dl></section>`;
}

function fichaHtml(
  project: ProjectRow,
  index: number,
  total: number,
  seia: SeiaRow | undefined,
  pertinencia: PertinenciaRow | undefined,
  pgp: PgpRow | undefined,
): string {
  const connection = project.project_connection?.[0];
  const chips = [
    project.technology?.name ?? null,
    // El chip de almacenamiento sólo aporta cuando no es ya un proyecto puro de baterías.
    project.includes_storage && project.project_kind !== "storage" ? "Con almacenamiento" : null,
    projectKindLabel(project.project_kind),
    project.status,
  ]
    .filter((chip): chip is string => Boolean(chip && chip.trim()))
    .map((chip) => `<span class="chip">${escapeHtml(chip)}</span>`)
    .join("");

  const identificacion = section("Identificación", [
    field("Código interno", text(project.internal_code)),
    field("NUP", text(project.nup)),
    field("Referencia externa", text(project.external_reference)),
    field("País", text(project.country?.code)),
    field("Tipo de proyecto", text(projectKindLabel(project.project_kind))),
    field("Tecnología", text(project.technology?.name)),
  ]);

  const capacidad = section("Capacidad", [
    field("Capacidad", num(project.capacity_mw, "MW")),
    field("Energía almacenable", num(project.capacity_mwh, "MWh")),
    field("Capacidad de generación", num(project.generation_capacity_mw, "MW")),
    field("Capacidad de almacenamiento", num(project.storage_capacity_mw, "MW")),
    field("Horas de almacenamiento", num(project.storage_hours, "h")),
    field("Inyección neta", num(project.net_injection_mw, "MW")),
    field("Retiro neto", num(project.net_withdrawal_mw, "MW")),
    field("Incluye almacenamiento", project.includes_storage ? "Sí" : "No"),
  ]);

  const ubicacion = section("Ubicación y titularidad", [
    field("Región", text(project.location?.region?.name)),
    field("Comuna", text(project.location?.comuna)),
    field("Empresa desarrolladora", text(project.developer?.name)),
    field("RUT", text(project.developer?.rut)),
    field("SPV", text(project.spv?.name)),
    field("Domicilio legal", text(project.developer?.legal_address)),
  ]);

  const conexion = section("Conexión y plazos", [
    field("Punto de conexión", text(connection?.connection_point)),
    // Mismo formato que la ficha web: la columna guarda el número pelado.
    field("Nivel de tensión", connection?.voltage_level ? text(`${connection.voltage_level} kV`) : EMPTY),
    field("Tipo de solicitud", text(connection?.request_type)),
    field("Estado", text(project.status)),
    field("Conexión estimada", date(project.estimated_connection_date)),
    field("Inicio de construcción", date(project.construction_start_date)),
  ]);

  const avance = pgp
    ? section("Avance de obras (PGP)", [
        field("Avance físico informado", num(pgp.progress_percent, "%")),
        field("Avance esperado", num(pgp.expected_progress_percent, "%")),
        field("Desviación", pgp.deviation_pp === null || pgp.deviation_pp === undefined ? EMPTY : num(pgp.deviation_pp, "pp")),
        field("Última observación", date(pgp.observed_at)),
        field("Estimación puesta en servicio", date(pgp.service_estimate_date)),
        field("Estimación entrada en operación", date(pgp.operative_estimate_date)),
      ])
    : "";

  const seiaSection = seia
    ? section("Evaluación ambiental (SEIA)", [
        field("Expediente", text(seia.nombre)),
        field("Titular", text(seia.titular_name)),
        field("Tipo de presentación", text(seia.submission_type)),
        field("Estado", text(seia.status)),
        field("Fecha de presentación", date(seia.filed_at)),
        field("Inversión declarada", usd(seia.investment_amount)),
      ])
    : "";

  const pertinenciaSection = pertinencia
    ? section("Consulta de pertinencia", [
        field("Consulta", text(pertinencia.name)),
        field("Titular", text(pertinencia.titular_name)),
        field("Estado", text(pertinencia.estado)),
        field("Sub-estado", text(pertinencia.sub_estado)),
        field("Presentación", date(pertinencia.fecha_presentacion)),
        field("Respuesta", date(pertinencia.fecha_respuesta)),
      ])
    : "";

  const sinExpedientes =
    !seia && !pertinencia && !pgp
      ? '<p class="note">Sin expediente SEIA, consulta de pertinencia ni avance de obras asociado a la fecha de este reporte.</p>'
      : "";

  return `<article class="ficha">
  <header class="ficha-head">
    <div class="ficha-title">
      <p class="eyebrow">Ficha de proyecto · ${index} de ${total}</p>
      <h1>${text(project.name)}</h1>
      <div class="chips">${chips}</div>
    </div>
    <div class="ficha-capacity">
      <span class="capacity-value">${num(project.capacity_mw, "MW")}</span>
      <span class="capacity-label">${text(project.location?.region?.name)}</span>
    </div>
  </header>
  ${identificacion}
  ${capacidad}
  ${ubicacion}
  ${conexion}
  ${avance}
  ${seiaSection}
  ${pertinenciaSection}
  ${sinExpedientes}
  <footer class="ficha-foot">
    <span>${text(project.internal_code)}</span>
    <span>Data verificada el ${date(project.verified_at)}</span>
  </footer>
</article>`;
}

function documentHtml(params: {
  projects: ProjectRow[];
  seiaByProject: Map<string, SeiaRow>;
  pertinenciaByProject: Map<string, PertinenciaRow>;
  pgpByProject: Map<string, PgpRow>;
  logoDataUri: string;
  generatedAt: string;
  verifiedOnly: boolean;
}): string {
  const { projects, seiaByProject, pertinenciaByProject, pgpByProject, logoDataUri, generatedAt, verifiedOnly } = params;

  const totalMw = projects.reduce((sum, p) => sum + (p.capacity_mw ?? 0), 0);
  const totalMwh = projects.reduce((sum, p) => sum + (p.capacity_mwh ?? 0), 0);
  const byTechnology = new Map<string, { count: number; mw: number }>();
  for (const p of projects) {
    const key = p.technology?.name ?? "Sin tecnología";
    const entry = byTechnology.get(key) ?? { count: 0, mw: 0 };
    entry.count += 1;
    entry.mw += p.capacity_mw ?? 0;
    byTechnology.set(key, entry);
  }
  const techRows = [...byTechnology.entries()]
    .sort((a, b) => b[1].mw - a[1].mw)
    .map(
      ([name, v]) =>
        `<tr><td>${escapeHtml(name)}</td><td class="right">${v.count}</td><td class="right">${num(v.mw, "MW", 0)}</td></tr>`,
    )
    .join("");

  const indexRows = projects
    .map(
      (p, i) =>
        `<tr><td class="right muted">${i + 1}</td><td>${text(p.name)}</td><td>${text(p.technology?.name)}</td>` +
        `<td>${text(p.location?.region?.name)}</td><td class="right">${num(p.capacity_mw, "MW", 0)}</td>` +
        `<td>${date(p.estimated_connection_date)}</td></tr>`,
    )
    .join("");

  const fichas = projects
    .map((p, i) =>
      fichaHtml(p, i + 1, projects.length, seiaByProject.get(p.id), pertinenciaByProject.get(p.id), pgpByProject.get(p.id)),
    )
    .join("\n");

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Fichas de proyectos — Transition Latam</title>
<style>
  @page { size: A4; margin: 12mm 12mm 10mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Segoe UI", Inter, system-ui, sans-serif;
    color: #2F3136;
    font-size: 9.5pt;
    line-height: 1.35;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1, h2, h3 { margin: 0; }
  .cover, .index, .ficha { break-after: page; }
  .ficha:last-child { break-after: auto; }

  /* Portada */
  .cover { display: flex; flex-direction: column; justify-content: space-between; height: 265mm; }
  .cover-top img { height: 16mm; }
  .cover-main h1 { font-size: 30pt; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; }
  .cover-main p.sub { font-size: 12pt; color: #6B7280; margin: 4mm 0 0; }
  .cover-rule { height: 3px; width: 40mm; background: #38D7C5; margin: 8mm 0; }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; margin-top: 10mm; }
  .kpi { border: 1px solid #E5E7EB; border-radius: 3mm; padding: 5mm; background: #F7F8FA; }
  .kpi .v { font-size: 20pt; font-weight: 700; display: block; }
  .kpi .l { font-size: 8pt; color: #6B7280; text-transform: uppercase; letter-spacing: 0.06em; }
  .cover-foot { font-size: 8pt; color: #6B7280; border-top: 1px solid #E5E7EB; padding-top: 4mm; }

  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  th { text-align: left; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.06em; color: #6B7280;
       border-bottom: 1px solid #2F3136; padding: 2mm 1.5mm; }
  td { padding: 1.6mm 1.5mm; border-bottom: 1px solid #E5E7EB; vertical-align: top; }
  td.right, th.right { text-align: right; }
  td.muted { color: #6B7280; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }

  .index h2, .cover-main h2 { font-size: 14pt; margin-bottom: 4mm; }
  .index .tech-table { margin-bottom: 8mm; }

  /* Ficha */
  .ficha { padding-bottom: 2mm; }
  .ficha-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 6mm;
                border-bottom: 2px solid #38D7C5; padding-bottom: 3mm; margin-bottom: 4mm; }
  .eyebrow { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.08em; color: #6B7280; margin: 0 0 1.5mm; }
  .ficha-head h1 { font-size: 16pt; font-weight: 700; letter-spacing: -0.01em; }
  .chips { margin-top: 2.5mm; display: flex; flex-wrap: wrap; gap: 1.5mm; }
  .chip { font-size: 7.5pt; padding: 0.8mm 2.2mm; border-radius: 8mm; background: #F7F8FA; border: 1px solid #E5E7EB; color: #2F3136; }
  .ficha-capacity { text-align: right; max-width: 55mm; flex: none; }
  .capacity-value { display: block; font-size: 15pt; font-weight: 700; color: #2F3136; white-space: nowrap; }
  .capacity-label { font-size: 8pt; color: #6B7280; }
  .ficha-title { min-width: 0; }

  section { margin-bottom: 3.5mm; break-inside: avoid; }
  section h2 { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.08em; color: #6B7280; margin-bottom: 2mm; }
  dl.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.5mm 4mm; margin: 0; }
  .field dt { font-size: 7.5pt; color: #6B7280; }
  .field dd { margin: 0.5mm 0 0; font-size: 9pt; font-weight: 600; word-break: break-word; }
  .field dd.empty { color: #C3C6CC; font-weight: 400; }
  .note { font-size: 8pt; color: #6B7280; background: #F7F8FA; border: 1px solid #E5E7EB;
          border-radius: 2mm; padding: 3mm; margin: 0 0 3mm; }
  .ficha-foot { position: running(none); display: flex; justify-content: space-between;
                font-size: 7.5pt; color: #6B7280; border-top: 1px solid #E5E7EB; padding-top: 2mm; margin-top: 2mm; }
</style>
</head>
<body>
  <div class="cover">
    <div class="cover-top"><img src="${logoDataUri}" alt="Transition Latam"></div>
    <div class="cover-main">
      <h1>Fichas de proyectos</h1>
      <div class="cover-rule"></div>
      <p class="sub">${verifiedOnly ? "Cartera verificada" : "Cartera completa"} · ${projects.length} proyectos · Chile</p>
      <div class="kpis">
        <div class="kpi"><span class="v">${projects.length}</span><span class="l">Proyectos</span></div>
        <div class="kpi"><span class="v">${num(totalMw, "", 0)}</span><span class="l">MW totales</span></div>
        <div class="kpi"><span class="v">${num(totalMwh, "", 0)}</span><span class="l">MWh de almacenamiento</span></div>
      </div>
    </div>
    <div class="cover-foot">
      Generado el ${generatedAt} · Transition Latam — Market Intelligence for the Energy Transition<br>
      ${
        verifiedOnly
          ? "Incluye únicamente proyectos con data verificada por el equipo editorial."
          : "Incluye toda la cartera, con y sin verificación editorial."
      }
    </div>
  </div>

  <div class="index">
    <h2>Resumen por tecnología</h2>
    <table class="tech-table">
      <thead><tr><th>Tecnología</th><th class="right">Proyectos</th><th class="right">Capacidad</th></tr></thead>
      <tbody>${techRows}</tbody>
    </table>
    <h2>Índice de fichas</h2>
    <table>
      <thead><tr><th class="right">#</th><th>Proyecto</th><th>Tecnología</th><th>Región</th><th class="right">MW</th><th>Conexión est.</th></tr></thead>
      <tbody>${indexRows}</tbody>
    </table>
  </div>

  ${fichas}
</body>
</html>`;
}

function findChromium(): string {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ].filter((p): p is string => Boolean(p));
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error("No se encontró Edge ni Chrome para imprimir el PDF (definí CHROME_PATH).");
  return found;
}

async function main() {
  const args = process.argv.slice(2);
  const verifiedOnly = !args.includes("--all");
  const outIndex = args.indexOf("--out");
  const generatedAt = new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
  const stamp = new Date().toISOString().slice(0, 10);
  const outPath = resolve(
    outIndex >= 0 && args[outIndex + 1]
      ? args[outIndex + 1]
      : join("exports", `fichas-proyectos-${verifiedOnly ? "verificados" : "todos"}-${stamp}.pdf`),
  );

  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    global: { fetch: serviceRoleFetch },
  });

  console.log(`Leyendo proyectos${verifiedOnly ? " verificados" : ""}…`);
  const projects = await fetchAllProjects(client, verifiedOnly);
  if (projects.length === 0) throw new Error("No hay proyectos que cumplan el filtro — no se genera PDF.");
  console.log(`  ${projects.length} proyectos`);

  const ids = projects.map((p) => p.id);
  const [seiaRows, pertinenciaRows, pgpRows] = await Promise.all([
    fetchByProjectIds<SeiaRow>(
      client,
      "seia_record",
      "project_id, nombre, titular_name, submission_type, status, filed_at, investment_amount, url_ficha",
      "project_id",
      ids,
    ),
    fetchByProjectIds<PertinenciaRow>(
      client,
      "pertinencia_consulta",
      "matched_project_id, name, titular_name, estado, sub_estado, fecha_presentacion, fecha_respuesta",
      "matched_project_id",
      ids,
      (q) => q.eq("match_status", "confirmed"),
    ),
    fetchByProjectIds<PgpRow>(
      client,
      "latest_pgp_project_progress",
      "project_id, progress_percent, expected_progress_percent, deviation_pp, observed_at, service_estimate_date, operative_estimate_date",
      "project_id",
      ids,
    ),
  ]);
  console.log(`  ${seiaRows.length} expedientes SEIA · ${pertinenciaRows.length} pertinencias · ${pgpRows.length} avances PGP`);

  const seiaByProject = new Map(seiaRows.map((r) => [r.project_id, r]));
  const pertinenciaByProject = new Map(pertinenciaRows.map((r) => [r.matched_project_id, r]));
  const pgpByProject = new Map(pgpRows.map((r) => [r.project_id, r]));

  const logoDataUri = `data:image/png;base64,${readFileSync(resolve("logo/TL.png")).toString("base64")}`;
  const html = documentHtml({ projects, seiaByProject, pertinenciaByProject, pgpByProject, logoDataUri, generatedAt, verifiedOnly });

  mkdirSync(dirname(outPath), { recursive: true });
  const htmlPath = `${outPath.replace(/\.pdf$/i, "")}.html`;
  writeFileSync(htmlPath, html, "utf8");

  console.log("Imprimiendo a PDF…");
  const chromium = findChromium();
  const userDataDir = join(process.env.TEMP ?? ".", `tl-pdf-${process.pid}`);
  try {
    execFileSync(
      chromium,
      [
        "--headless=new",
        "--disable-gpu",
        `--user-data-dir=${userDataDir}`,
        "--no-pdf-header-footer",
        `--print-to-pdf=${outPath}`,
        `file:///${htmlPath.replace(/\\/g, "/")}`,
      ],
      { stdio: "inherit", timeout: 10 * 60 * 1000 },
    );
  } finally {
    // El perfil temporal queda con archivos abiertos un instante después de cerrar el
    // navegador (EBUSY en Windows) — no es motivo para fallar un PDF ya escrito.
    try {
      rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      /* se lo lleva la limpieza de %TEMP% */
    }
  }
  if (!existsSync(outPath)) throw new Error("El navegador no generó el PDF.");
  console.log(`PDF: ${outPath}`);
  console.log(`HTML fuente: ${htmlPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
