import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeRutDigits } from "@/lib/ingestion/sources/sea-pertinencia/matching";

export type PertinenciaTab = "pending" | "verified" | "confirmed" | "rejected" | "no_match_available";

export interface PertinenciaQueueItem {
  id: string;
  correlativeId: string;
  name: string;
  titularName: string | null;
  titularRut: string | null;
  region: string | null;
  comuna: string | null;
  estado: string | null;
  subEstado: string | null;
  requiereIngreso: string | null;
  fechaPresentacion: string | null;
  fechaRespuesta: string | null;
  documentos: Array<{ nombre: string; fecha: string; url: string }>;
  suggestedProjectId: string | null;
  suggestedProjectName: string | null;
  suggestedMatchScore: number | null;
  /** El RUT del titular de la pertinencia coincide con el RUT de la empresa desarrolladora del proyecto sugerido — señal más fuerte que la similitud de nombre. */
  suggestedRutMatches: boolean;
  /** El proyecto sugerido ya fue verificado antes por un admin — revisar la pertinencia es solo confirmar la asociación, no verificar datos del proyecto de nuevo. */
  suggestedProjectVerified: boolean;
  matchStatus: "pending" | "confirmed" | "rejected" | "no_match_available";
}

/**
 * Traduce subEstado/estado a la conclusión que pide el negocio. Los valores
 * cubiertos son los observados empíricamente en los ~2.243 registros reales
 * cargados (2026-08-05) — no son los estados "de manual" del trámite SEA
 * (que incluyen etapas intermedias como "Admisible" o "En elaboración de
 * pronunciamiento" que la API de listado no expone, solo estado/subEstado
 * finales). Si aparece una combinación nueva no listada acá, cae al genérico
 * "Otro (...)" — revisar `scripts/rematch-pertinencias.ts` o correr un
 * conteo de estado/subEstado reales para ampliar esta función.
 */
export function clasificarConclusionPertinencia(estado: string | null, subEstado: string | null): string {
  if (subEstado === "Resuelta - Ingreso al SEIA") return "Ingresa al SEIA";
  if (subEstado === "Resuelta - No ingreso al SEIA") return "No ingresa al SEIA";
  if (subEstado === "Resuelta - Desistida") return "Desistida";
  if (subEstado === "Resuelta - Abandono") return "Abandonada";
  if (subEstado === "Resuelta - No admitida a tramitación") return "No admitida a trámite";
  if (estado === "Derivada a SMA") return "Derivada a SMA";
  if (estado === "En análisis-suspendida") return "En análisis (suspendida)";
  if (estado === "En análisis" || estado === "En Análisis") return "En análisis";
  if (estado === "Resuelta" && !subEstado) return "Resuelta (sin detalle)";
  if (subEstado) return `Otro (${subEstado})`;
  return estado ? `Otro (${estado})` : "Sin datos";
}

const SELECT = `
  id, correlative_id, name, titular_name, titular_rut, region, comuna, estado, sub_estado,
  requiere_ingreso, fecha_presentacion, fecha_respuesta, documentos, match_status,
  suggested_match_score, suggested_project_id,
  suggested_project:suggested_project_id(name, verified_at, developer_company:developer_company_id(rut))
`;

type CompanyRutJoin = { rut: string | null } | { rut: string | null }[] | null;

type Row = {
  id: string;
  correlative_id: string;
  name: string;
  titular_name: string | null;
  titular_rut: string | null;
  region: string | null;
  comuna: string | null;
  estado: string | null;
  sub_estado: string | null;
  requiere_ingreso: string | null;
  fecha_presentacion: string | null;
  fecha_respuesta: string | null;
  documentos: Array<{ nombre: string; fecha: string; url: string }> | null;
  match_status: PertinenciaQueueItem["matchStatus"];
  suggested_match_score: number | null;
  suggested_project_id: string | null;
  suggested_project: { name: string; verified_at: string | null; developer_company: CompanyRutJoin } | null;
};

function mapRow(row: Row): PertinenciaQueueItem {
  const company = row.suggested_project?.developer_company ?? null;
  const developerRut = Array.isArray(company) ? (company[0]?.rut ?? null) : (company?.rut ?? null);
  const rutMatches =
    row.suggested_project_id !== null &&
    normalizeRutDigits(row.titular_rut) !== null &&
    normalizeRutDigits(row.titular_rut) === normalizeRutDigits(developerRut);

  return {
    id: row.id,
    correlativeId: row.correlative_id,
    name: row.name,
    titularName: row.titular_name,
    titularRut: row.titular_rut,
    region: row.region,
    comuna: row.comuna,
    estado: row.estado,
    subEstado: row.sub_estado,
    requiereIngreso: row.requiere_ingreso,
    fechaPresentacion: row.fecha_presentacion,
    fechaRespuesta: row.fecha_respuesta,
    documentos: row.documentos ?? [],
    suggestedProjectId: row.suggested_project_id,
    suggestedProjectName: row.suggested_project?.name ?? null,
    suggestedMatchScore: row.suggested_match_score,
    suggestedRutMatches: rutMatches,
    suggestedProjectVerified: row.suggested_project?.verified_at !== null && row.suggested_project?.verified_at !== undefined,
    matchStatus: row.match_status,
  };
}

/**
 * "verified" no es un match_status propio — es un recorte del "pending" para
 * separar las pertinencias cuyo proyecto sugerido YA fue verificado antes:
 * ahí el trabajo del admin es solo confirmar que la pertinencia corresponde
 * a ese proyecto, no revisar los datos del proyecto de nuevo.
 */
export async function getPertinenciasQueue(client: SupabaseClient, tab: PertinenciaTab = "pending", limit = 200): Promise<PertinenciaQueueItem[]> {
  const dbStatus = tab === "verified" ? "pending" : tab;
  const { data, error } = await client
    .from("pertinencia_consulta")
    .select(SELECT)
    .eq("match_status", dbStatus)
    .order("fecha_presentacion", { ascending: false, nullsFirst: false })
    .limit(tab === "verified" ? 2000 : limit);
  if (error) throw new Error(`Error obteniendo cola de pertinencias: ${error.message}`);
  const items = ((data ?? []) as unknown as Row[]).map(mapRow);
  if (tab === "verified") return items.filter((i) => i.suggestedProjectVerified).slice(0, limit);
  if (tab === "pending") return items.filter((i) => !i.suggestedProjectVerified);
  return items;
}

export interface ConfirmedPertinencia {
  id: string;
  name: string;
  titularName: string | null;
  estado: string | null;
  subEstado: string | null;
  fechaPresentacion: string | null;
  fechaRespuesta: string | null;
  documentos: Array<{ nombre: string; fecha: string; url: string }>;
}

/** La pertinencia que un admin confirmó como asociada a este proyecto — se muestra en la ficha pública. */
export async function getConfirmedPertinenciaForProject(client: SupabaseClient, projectId: string): Promise<ConfirmedPertinencia | null> {
  const { data, error } = await client
    .from("pertinencia_consulta")
    .select("id, name, titular_name, estado, sub_estado, fecha_presentacion, fecha_respuesta, documentos")
    .eq("matched_project_id", projectId)
    .eq("match_status", "confirmed")
    .order("fecha_presentacion", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Error obteniendo pertinencia confirmada del proyecto: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    titularName: data.titular_name,
    estado: data.estado,
    subEstado: data.sub_estado,
    fechaPresentacion: data.fecha_presentacion,
    fechaRespuesta: data.fecha_respuesta,
    documentos: data.documentos ?? [],
  };
}

/**
 * El sub-estado de la pertinencia confirmada de varios proyectos, en una sola
 * consulta — la tabla de Proyectos Futuros lo necesita para toda la página y
 * pedirlo proyecto por proyecto serían 20 viajes por render.
 *
 * Solo el sub-estado: es lo único que decide si la situación ambiental quedó
 * resuelta favorablemente (ver `resolveEnvironmentalEvidence`). Traer la ficha
 * completa acá sería cargar documentos que la tabla no muestra.
 */
export async function getConfirmedPertinenciaSubEstados(
  client: SupabaseClient,
  projectIds: string[],
): Promise<Map<string, string | null>> {
  if (projectIds.length === 0) return new Map();
  const { data, error } = await client
    .from("pertinencia_consulta")
    .select("matched_project_id, sub_estado, fecha_respuesta")
    .in("matched_project_id", projectIds)
    .eq("match_status", "confirmed")
    .order("fecha_respuesta", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`Error obteniendo pertinencias confirmadas: ${error.message}`);

  const result = new Map<string, string | null>();
  for (const row of (data ?? []) as Array<{ matched_project_id: string; sub_estado: string | null }>) {
    // La primera gana: vienen de la más reciente a la más antigua, y si un
    // proyecto tiene varias pertinencias la vigente es la última resuelta.
    if (!result.has(row.matched_project_id)) result.set(row.matched_project_id, row.sub_estado);
  }
  return result;
}

export async function countPertinenciasPending(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from("pertinencia_consulta")
    .select("id", { count: "exact", head: true })
    .eq("match_status", "pending");
  if (error) throw new Error(`Error contando pertinencias pendientes: ${error.message}`);
  return count ?? 0;
}
