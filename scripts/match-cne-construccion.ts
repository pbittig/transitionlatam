/**
 * Vincula la nómina de Declaración en Construcción de CNE con los proyectos.
 *
 *   npx tsx scripts/match-cne-construccion.ts            # simulación (no escribe)
 *   npx tsx scripts/match-cne-construccion.ts --apply
 *
 * POR QUÉ IMPORTA. CNE es la única fuente que entrega el acto administrativo
 * citable detrás de "declarado en construcción": número y fecha de resolución.
 * El Coordinador dice que el proyecto está declarado; CNE dice con qué
 * resolución. Sin este cruce, esas 193 filas no llegan a ninguna ficha.
 *
 * LA REGLA. Misma lección que el cruce de pertinencias: una sola señal no
 * alcanza. Se exige coincidencia de nombre (tokens distintivos, el mismo
 * tokenizador que usa el cruce de pertinencias) MÁS al menos una corroboración
 * independiente:
 *
 *   · misma región, o
 *   · misma potencia (±5%), o
 *   · mismo propietario que la empresa desarrolladora.
 *
 * Un nombre idéntico con las tres corroboraciones ausentes no se confirma: en
 * la nómina hay nombres genéricos repetidos entre empresas distintas.
 */
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { jaccardScore, tokenizeProjectName } from "../lib/ingestion/sources/sea-pertinencia/matching";

config({ path: ".env.local" });

const MATCH_RULE = "auto_name_plus_corroboration";
/** Piso de similitud de nombre. Por debajo no se mira siquiera la corroboración. */
const MIN_NAME_SCORE = 60;
/** Tolerancia de potencia: la nómina reporta potencia neta y nosotros la capacidad declarada; no son idénticas. */
const CAPACITY_TOLERANCE = 0.05;

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function regionMatches(a: string | null, b: string | null): boolean {
  const clean = (value: string | null) => normalizeText(value).replace(/^region\s+(de\s+|del\s+|de\s+la\s+)?/, "");
  const x = clean(a);
  const y = clean(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

interface ProjectRow {
  id: string;
  name: string;
  status: string | null;
  capacity_mw: number | string | null;
  location: { region: { name: string } | null } | null;
  developer: { name: string } | null;
}

interface CneRow {
  id: string;
  proyecto_central: string;
  propietario: string | null;
  potencia_neta_mw: number | string | null;
  region: string | null;
  res_original: string | null;
}

async function loadProjects(client: SupabaseClient): Promise<ProjectRow[]> {
  const rows: ProjectRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from("project")
      .select("id, name, status, capacity_mw, location:location_id(region:region_id(name)), developer:developer_company_id(name)")
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(`Error cargando proyectos: ${error.message}`);
    const batch = (data ?? []) as unknown as ProjectRow[];
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const serviceRoleFetch: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    if (headers.get("authorization")?.startsWith("Bearer sb_secret_")) headers.delete("authorization");
    return fetch(input, { ...init, headers });
  };
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    global: { fetch: serviceRoleFetch },
  });

  const [projects, { data: cneData, error: cneError }] = await Promise.all([
    loadProjects(client),
    client
      .from("construction_project")
      .select("id, proyecto_central, propietario, potencia_neta_mw, region, res_original")
      .is("project_id", null),
  ]);
  if (cneError) throw new Error(`Error cargando la nómina de CNE: ${cneError.message}`);
  const cneRows = (cneData ?? []) as unknown as CneRow[];

  const projectTokens = projects.map((project) => ({ project, tokens: tokenizeProjectName(project.name) }));

  interface Decision {
    cne: CneRow;
    project: ProjectRow;
    score: number;
    corroborations: string[];
  }
  const confirmable: Decision[] = [];
  const weak: Decision[] = [];
  let sinCandidato = 0;

  for (const cne of cneRows) {
    const tokens = tokenizeProjectName(cne.proyecto_central);
    if (tokens.size === 0) {
      sinCandidato++;
      continue;
    }
    let best: { project: ProjectRow; score: number } | null = null;
    for (const candidate of projectTokens) {
      const score = jaccardScore(tokens, candidate.tokens);
      if (score >= MIN_NAME_SCORE && (!best || score > best.score)) best = { project: candidate.project, score };
    }
    if (!best) {
      sinCandidato++;
      continue;
    }

    const corroborations: string[] = [];
    if (regionMatches(cne.region, best.project.location?.region?.name ?? null)) corroborations.push("región");

    const cneMw = cne.potencia_neta_mw === null ? null : Number(cne.potencia_neta_mw);
    const projectMw = best.project.capacity_mw === null ? null : Number(best.project.capacity_mw);
    if (cneMw && projectMw && Math.abs(cneMw - projectMw) <= Math.max(cneMw, projectMw) * CAPACITY_TOLERANCE) {
      corroborations.push("potencia");
    }

    const owner = normalizeText(cne.propietario);
    const developer = normalizeText(best.project.developer?.name);
    if (owner && developer && (owner === developer || owner.includes(developer) || developer.includes(owner))) {
      corroborations.push("propietario");
    }

    const decision: Decision = { cne, project: best.project, score: best.score, corroborations };
    (corroborations.length > 0 ? confirmable : weak).push(decision);
  }

  const declared = confirmable.filter((d) =>
    normalizeText(d.project.status).startsWith("proyecto declarado en construc"),
  ).length;

  console.log(`Filas de CNE sin vincular:        ${cneRows.length}`);
  console.log(`Vinculables (nombre + ≥1 señal):  ${confirmable.length}`);
  console.log(`  · de esas, ya declaradas en nuestro estado: ${declared}`);
  console.log(`  · CONFLICTO — CNE las declara y nosotros no: ${confirmable.length - declared}`);
  console.log(`Nombre parecido sin corroborar:   ${weak.length}  (quedan sin vincular)`);
  console.log(`Sin candidato de nombre:          ${sinCandidato}`);

  console.log("\nMuestra de lo que se vincularía:");
  for (const d of confirmable.slice(0, 6)) {
    console.log(`  "${d.cne.proyecto_central}" -> "${d.project.name}"  [${d.score}% · ${d.corroborations.join("+")}] Res. ${d.cne.res_original ?? "?"}`);
  }
  if (weak.length) {
    console.log("\nMuestra de lo que NO se vincula (nombre solo):");
    for (const d of weak.slice(0, 4)) {
      console.log(`  "${d.cne.proyecto_central}" -> "${d.project.name}"  [${d.score}%, sin corroboración]`);
    }
  }

  if (!apply) {
    console.log("\nSimulación: no se escribió nada. Repetir con --apply para vincular.");
    return;
  }

  const confirmedAt = new Date().toISOString();
  for (const d of confirmable) {
    const { error } = await client
      .from("construction_project")
      .update({
        project_id: d.project.id,
        match_score: d.score,
        match_confirmed_by: MATCH_RULE,
        match_confirmed_at: confirmedAt,
      })
      .eq("id", d.cne.id)
      .is("project_id", null);
    if (error) throw new Error(`Error vinculando ${d.cne.id}: ${error.message}`);
  }
  console.log(`\nVinculadas: ${confirmable.length} (marcadas como "${MATCH_RULE}", reversibles por lote).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
