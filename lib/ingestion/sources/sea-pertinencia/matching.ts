import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeForMatch } from "@/lib/ingestion/sources/energia-abierta/listado/normalize";

export interface MatchCandidate {
  projectId: string;
  projectName: string;
  score: number; // 0-100, determinístico (Jaccard sobre tokens) — no es un modelo de IA
}

/**
 * Palabras genéricas del dominio energético — quitarlas deja solo la parte
 * distintiva del nombre (ej. "BESS Santa Ana de Maipo" -> {santa, ana, maipo}),
 * si no, dos proyectos BESS cualquiera matchearían solo por compartir "bess".
 */
const STOPWORDS = new Set([
  "proyecto", "parque", "central", "sistema", "de", "del", "la", "el", "los", "las",
  "energia", "energía", "almacenamiento", "bess", "fotovoltaico", "fotovoltaica",
  "solar", "eolico", "eólico", "cdp", "consulta", "pertinencia", "planta", "etapa",
]);

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
}

/** Trae todos los proyectos UNA vez por corrida — pasar el resultado a suggestProjectMatch, nunca re-consultar por fila. */
export async function loadProjectCandidates(client: SupabaseClient): Promise<ProjectCandidate[]> {
  const allProjects: ProjectCandidate[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from("project").select("id, name").range(offset, offset + 999);
    if (error) throw new Error(`Error cargando proyectos para matching: ${error.message}`);
    allProjects.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return allProjects;
}

/**
 * Sugiere el proyecto existente más parecido por nombre — semi-asistido, un
 * humano confirma o rechaza (ver docs/04-modelo-datos.md §4.6, mismo
 * criterio que entity_alias). No filtra por vigente: una pertinencia de
 * modificación suele referirse a un proyecto ya avanzado/construido.
 */
export function suggestProjectMatch(pertinenciaName: string, candidates: ProjectCandidate[]): MatchCandidate | null {
  const targetTokens = tokenize(pertinenciaName);
  if (targetTokens.size === 0) return null;

  let best: MatchCandidate | null = null;
  for (const project of candidates) {
    const score = jaccardScore(targetTokens, tokenize(project.name));
    if (score > 0 && (!best || score > best.score)) {
      best = { projectId: project.id, projectName: project.name, score };
    }
  }
  return best;
}
