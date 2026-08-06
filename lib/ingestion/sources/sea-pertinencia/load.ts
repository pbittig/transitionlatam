import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedPertinencia } from "./normalize";
import { suggestProjectMatch, loadProjectCandidates } from "./matching";

export interface LoadSummary {
  totalRows: number;
  created: number;
  updated: number;
  matchesSuggested: number;
}

/**
 * Upsert por qid_process. Una vez que un humano confirma/rechaza el match
 * sugerido (match_status != 'pending'), corridas futuras nunca lo tocan —
 * solo refrescan los datos propios de la pertinencia (estado, documentos),
 * igual que "proyecto verificado" en el resto del sistema.
 */
export async function loadPertinencias(client: SupabaseClient, rows: NormalizedPertinencia[]): Promise<LoadSummary> {
  const summary: LoadSummary = { totalRows: rows.length, created: 0, updated: 0, matchesSuggested: 0 };
  const projectCandidates = rows.length > 0 ? await loadProjectCandidates(client) : [];

  for (const row of rows) {
    const { data: existing, error: existingError } = await client
      .from("pertinencia_consulta")
      .select("id, match_status")
      .eq("qid_process", row.qidProcess)
      .maybeSingle();
    if (existingError) throw new Error(`Error buscando pertinencia existente ${row.qidProcess}: ${existingError.message}`);

    const baseFields = {
      correlative_id: row.correlativeId,
      name: row.name,
      titular_name: row.titularName,
      titular_rut: row.titularRut,
      region: row.region,
      comuna: row.comuna,
      estado: row.estado,
      sub_estado: row.subEstado,
      requiere_ingreso: row.requiereIngreso,
      fecha_presentacion: row.fechaPresentacion,
      fecha_respuesta: row.fechaRespuesta,
      tipologia_seia: row.tipologiaSeia,
      descripcion: row.descripcion,
      documentos: row.documentos,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error: updateError } = await client.from("pertinencia_consulta").update(baseFields).eq("id", existing.id);
      if (updateError) throw new Error(`Error actualizando pertinencia ${row.qidProcess}: ${updateError.message}`);
      summary.updated += 1;

      if (existing.match_status === "pending") {
        const candidate = suggestProjectMatch(row.name, projectCandidates, row.titularRut);
        if (candidate) {
          await client
            .from("pertinencia_consulta")
            .update({ suggested_project_id: candidate.projectId, suggested_match_score: candidate.score })
            .eq("id", existing.id);
          summary.matchesSuggested += 1;
        }
      }
      continue;
    }

    const { data: inserted, error: insertError } = await client
      .from("pertinencia_consulta")
      .insert({ qid_process: row.qidProcess, ...baseFields })
      .select("id")
      .single();
    if (insertError) throw new Error(`Error creando pertinencia ${row.qidProcess}: ${insertError.message}`);
    summary.created += 1;

    const candidate = suggestProjectMatch(row.name, projectCandidates);
    if (candidate) {
      await client
        .from("pertinencia_consulta")
        .update({ suggested_project_id: candidate.projectId, suggested_match_score: candidate.score })
        .eq("id", inserted.id);
      summary.matchesSuggested += 1;
    }
  }

  return summary;
}
