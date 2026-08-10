import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeForMatch } from "@/lib/ingestion/sources/energia-abierta/listado/normalize";

export interface MatchCandidate {
  projectId: string;
  projectName: string;
  score: number; // 0-100, determinístico (Jaccard sobre tokens) — no es un modelo de IA
  matchedBy: "rut" | "name";
}

/** Deja solo dígitos y K/k (dígito verificador) para comparar RUTs con formato distinto (con o sin puntos/guión). */
export function normalizeRutDigits(rut: string | null | undefined): string | null {
  if (!rut) return null;
  const clean = rut.toUpperCase().replace(/[^0-9K]/g, "");
  return clean.length < 2 ? null : clean;
}

/**
 * Palabras genéricas del dominio energético — quitarlas deja solo la parte
 * distintiva del nombre (ej. "BESS Santa Ana de Maipo" -> {santa, ana, maipo}),
 * si no, dos proyectos BESS cualquiera matchearían solo por compartir "bess".
 *
 * "modificacion" y afines (hallazgo real, 2026-08-08): un porcentaje enorme de
 * las pertinencias son literalmente "Modificación de <proyecto>" — sin esta
 * palabra en stopwords, cualquier proyecto cuyo propio nombre contuviera
 * "modificación" (ej. "Modificación conexión MCH Llauquereo") terminaba como
 * el candidato de mayor Jaccard para cientos de pertinencias sin relación real
 * (109 sugerencias falsas solo para ese proyecto). Mismo problema con otros
 * prefijos genéricos de trámites de modificación.
 */
const STOPWORDS = new Set([
  "proyecto", "parque", "central", "sistema", "de", "del", "la", "el", "los", "las",
  "energia", "energía", "almacenamiento", "bess", "fotovoltaico", "fotovoltaica",
  "solar", "eolico", "eólico", "cdp", "consulta", "pertinencia", "planta", "etapa",
  "modificacion", "modificaciones", "aumento", "ampliacion", "disminucion", "reduccion",
]);

/**
 * Piso mínimo de Jaccard para aceptar un match por nombre — sin esto, un solo
 * token genérico compartido por accidente (fuera de la lista de stopwords)
 * igual "gana" como mejor candidato aunque el resto de los nombres no tenga
 * nada en común. No aplica al match por RUT (score 100, siempre confiable).
 */
const MIN_NAME_MATCH_SCORE = 20;

function tokenize(name: string): Set<string> {
  return new Set(normalizeForMatch(name).split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w)));
}

function jaccardScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : Math.round((intersection / union) * 100);
}

export interface ProjectCandidate {
  id: string;
  name: string;
  developerRut: string | null;
}

type CompanyRutJoin = { rut: string | null } | { rut: string | null }[] | null;

/** Trae todos los proyectos UNA vez por corrida — pasar el resultado a suggestProjectMatch, nunca re-consultar por fila. */
export async function loadProjectCandidates(client: SupabaseClient): Promise<ProjectCandidate[]> {
  const allProjects: ProjectCandidate[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from("project")
      .select("id, name, developer_company:developer_company_id(rut)")
      .range(offset, offset + 999);
    if (error) throw new Error(`Error cargando proyectos para matching: ${error.message}`);
    for (const row of data ?? []) {
      const company = row.developer_company as CompanyRutJoin;
      const rut = Array.isArray(company) ? (company[0]?.rut ?? null) : (company?.rut ?? null);
      allProjects.push({ id: row.id, name: row.name, developerRut: normalizeRutDigits(rut) });
    }
    if (!data || data.length < 1000) break;
  }
  return allProjects;
}

/**
 * Sugiere el proyecto existente más parecido — semi-asistido, un humano
 * confirma o rechaza (ver docs/04-modelo-datos.md §4.6, mismo criterio que
 * entity_alias). El RUT del titular es una señal más confiable que el nombre
 * (dos empresas con nombres parecidos pueden ser RUTs distintos, y viceversa
 * el mismo RUT puede aparecer escrito de formas distintas) — si el RUT del
 * titular coincide con el de la empresa desarrolladora de algún proyecto, esa
 * coincidencia gana siempre sobre la similitud de nombre. No filtra por
 * vigente: una pertinencia de modificación suele referirse a un proyecto ya
 * avanzado/construido.
 */
export function suggestProjectMatch(
  pertinenciaName: string,
  candidates: ProjectCandidate[],
  titularRut?: string | null,
): MatchCandidate | null {
  const rutNorm = normalizeRutDigits(titularRut);
  if (rutNorm) {
    const rutMatch = candidates.find((c) => c.developerRut === rutNorm);
    if (rutMatch) return { projectId: rutMatch.id, projectName: rutMatch.name, score: 100, matchedBy: "rut" };
  }

  const targetTokens = tokenize(pertinenciaName);
  if (targetTokens.size === 0) return null;

  let best: MatchCandidate | null = null;
  for (const project of candidates) {
    const score = jaccardScore(targetTokens, tokenize(project.name));
    if (score >= MIN_NAME_MATCH_SCORE && (!best || score > best.score)) {
      best = { projectId: project.id, projectName: project.name, score, matchedBy: "name" };
    }
  }
  return best;
}

export interface PertinenciaCandidateForProjectMatch {
  id: string;
  name: string;
  titularRut: string | null;
}

export interface PertinenciaSuggestionForProject {
  pertinenciaId: string;
  pertinenciaName: string;
  score: number;
  matchedBy: "rut" | "name";
}

/** Carga las pertinencias aún sin resolver (match_status='pending') — candidatas para el fallback automático cuando SEIA no encuentra nada (ver match-seia-projects.ts). */
export async function loadPendingPertinenciaCandidates(client: SupabaseClient): Promise<PertinenciaCandidateForProjectMatch[]> {
  const all: PertinenciaCandidateForProjectMatch[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from("pertinencia_consulta")
      .select("id, name, titular_rut")
      .eq("match_status", "pending")
      .range(offset, offset + 999);
    if (error) throw new Error(`Error cargando pertinencias pendientes: ${error.message}`);
    for (const row of data ?? []) all.push({ id: row.id, name: row.name, titularRut: row.titular_rut as string | null });
    if (!data || data.length < 1000) break;
  }
  return all;
}

/**
 * Mismo criterio que suggestProjectMatch pero en dirección inversa: dado un
 * proyecto que se quedó sin match SEIA, busca la pertinencia pendiente más
 * parecida. Nunca confirma sola — solo deja `suggested_project_id` listo en la
 * pertinencia para que un humano lo confirme en /admin/pertinencias, mismo
 * criterio semi-asistido que ya usa el resto de este sistema.
 */
export function suggestPertinenciaForProject(
  projectName: string,
  projectDeveloperRut: string | null,
  candidates: PertinenciaCandidateForProjectMatch[],
): PertinenciaSuggestionForProject | null {
  const rutNorm = normalizeRutDigits(projectDeveloperRut);
  if (rutNorm) {
    const rutMatch = candidates.find((c) => normalizeRutDigits(c.titularRut) === rutNorm);
    if (rutMatch) return { pertinenciaId: rutMatch.id, pertinenciaName: rutMatch.name, score: 100, matchedBy: "rut" };
  }

  const targetTokens = tokenize(projectName);
  if (targetTokens.size === 0) return null;

  let best: PertinenciaSuggestionForProject | null = null;
  for (const candidate of candidates) {
    const score = jaccardScore(targetTokens, tokenize(candidate.name));
    if (score >= MIN_NAME_MATCH_SCORE && (!best || score > best.score)) {
      best = { pertinenciaId: candidate.id, pertinenciaName: candidate.name, score, matchedBy: "name" };
    }
  }
  return best;
}
