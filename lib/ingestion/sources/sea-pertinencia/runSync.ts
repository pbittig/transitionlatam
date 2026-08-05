import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchPertinenciaListado, fetchPertinenciaDetalle } from "./fetchFromApi";
import { isRelevantPertinencia } from "./filter";
import { normalizePertinenciaDetail } from "./normalize";
import { loadPertinencias, type LoadSummary } from "./load";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";

export interface PertinenciaSyncSummary extends LoadSummary {
  totalListado: number;
  relevantes: number;
  detalleConsultado: number;
  detalleFallido: number;
}

/**
 * El listado ya trae estado/subEstado por fila (sin pedir el detalle) — solo
 * se pide el detalle completo (más lento, ~350 requests si se hiciera para
 * todo) para lo genuinamente NUEVO o con estado CAMBIADO desde la última
 * corrida. Evita recargar el detalle de algo ya resuelto que no cambió.
 */
export async function runPertinenciaSync(client?: SupabaseClient): Promise<PertinenciaSyncSummary> {
  const supabase = client ?? createSupabaseServiceClient();

  const listado = await fetchPertinenciaListado();
  const relevantes = listado.filter(isRelevantPertinencia);

  const { data: existingRows, error: existingError } = await supabase
    .from("pertinencia_consulta")
    .select("qid_process, estado, sub_estado");
  if (existingError) throw new Error(`Error cargando pertinencias existentes: ${existingError.message}`);
  const existingByQid = new Map((existingRows ?? []).map((r) => [r.qid_process as string, r]));

  const toFetch = relevantes.filter((row) => {
    const existing = existingByQid.get(row.qidProcess);
    if (!existing) return true; // nuevo
    return existing.estado !== (row.state?.valor ?? null) || existing.sub_estado !== (row.subEstado ?? null);
  });

  const normalized = [];
  let detalleFallido = 0;
  for (const row of toFetch) {
    try {
      const detail = await fetchPertinenciaDetalle(row.qidProcess);
      if (!detail?.pertinencia?.qidProcess) {
        throw new Error("Respuesta sin objeto 'pertinencia' (forma inesperada)");
      }
      normalized.push(normalizePertinenciaDetail(detail));
    } catch (err) {
      // Un caso raro no debe tumbar el resto de la corrida — se cuenta y se
      // sigue; caso real (2026-08-05): al menos una fila devolvió una forma
      // de respuesta distinta a la esperada.
      detalleFallido += 1;
      console.warn(`[sea-pertinencia] Detalle falló para ${row.correlativeId} (${row.qidProcess}): ${(err as Error).message}`);
    }
    // Cortesía con el servidor público del SEA — no es un requisito documentado.
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  const loadSummary = await loadPertinencias(supabase, normalized);

  return {
    ...loadSummary,
    totalListado: listado.length,
    relevantes: relevantes.length,
    detalleConsultado: toFetch.length,
    detalleFallido,
  };
}
