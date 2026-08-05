import type { SupabaseClient } from "@supabase/supabase-js";

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
  matchStatus: "pending" | "confirmed" | "rejected" | "no_match_available";
}

/** Traduce subEstado/estado a la conclusión que pide el negocio — mismo criterio que scripts/sea-pertinencia-test.mjs de la prueba técnica. */
export function clasificarConclusionPertinencia(estado: string | null, subEstado: string | null): string {
  if (subEstado === "Resuelta - Ingreso al SEIA") return "Ingresa al SEIA";
  if (subEstado === "Resuelta - No ingreso al SEIA") return "No ingresa al SEIA";
  if (estado === "En análisis" || estado === "En Análisis") return "En análisis";
  if (subEstado) return `Otro (${subEstado})`;
  return estado ? `Otro (${estado})` : "Sin datos";
}

const SELECT = `
  id, correlative_id, name, titular_name, titular_rut, region, comuna, estado, sub_estado,
  requiere_ingreso, fecha_presentacion, fecha_respuesta, documentos, match_status,
  suggested_match_score, suggested_project_id, suggested_project:suggested_project_id(name)
`;

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
  suggested_project: { name: string } | null;
};

function mapRow(row: Row): PertinenciaQueueItem {
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
    matchStatus: row.match_status,
  };
}

export async function getPertinenciasQueue(client: SupabaseClient, status: PertinenciaQueueItem["matchStatus"] = "pending", limit = 200): Promise<PertinenciaQueueItem[]> {
  const { data, error } = await client
    .from("pertinencia_consulta")
    .select(SELECT)
    .eq("match_status", status)
    .order("fecha_presentacion", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`Error obteniendo cola de pertinencias: ${error.message}`);
  return ((data ?? []) as unknown as Row[]).map(mapRow);
}

export async function countPertinenciasPending(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from("pertinencia_consulta")
    .select("id", { count: "exact", head: true })
    .eq("match_status", "pending");
  if (error) throw new Error(`Error contando pertinencias pendientes: ${error.message}`);
  return count ?? 0;
}
