import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeForMatch } from "../energia-abierta/listado/normalize";
import type { RawSeiaProject } from "./types";

function epochSecondsToIsoDate(epochSeconds: string): string | null {
  const n = Number(epochSeconds);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000).toISOString().slice(0, 10);
}

async function getSeiaDataSourceId(client: SupabaseClient): Promise<string> {
  const { data } = await client.from("data_source").select("id").eq("name", "SEIA - Servicio de Evaluación Ambiental").single();
  if (!data) throw new Error("No se encontró el data_source de SEIA");
  return data.id as string;
}

export async function saveSeiaMatch(
  client: SupabaseClient,
  projectId: string,
  candidate: RawSeiaProject,
  confidence: "alta" | "media" | "baja",
  method: string = "nombre_normalizado_region",
): Promise<void> {
  // Leer el estado previo antes de desvinculaciones y upsert
  const { data: previous } = await client.from("seia_record").select("seia_id, status").eq("project_id", projectId).maybeSingle();

  // Un proyecto solo debería tener un expediente SEIA asociado a la vez — si ya
  // tenía uno distinto (ej. un match automático que se está corrigiendo a mano),
  // se desvincula primero para no dejar dos filas apuntando al mismo proyecto.
  await client.from("seia_record").update({ project_id: null }).eq("project_id", projectId).neq("seia_id", candidate.EXPEDIENTE_ID);

  const row = {
    seia_id: candidate.EXPEDIENTE_ID,
    project_id: projectId,
    nombre: candidate.EXPEDIENTE_NOMBRE,
    name_normalized: normalizeForMatch(candidate.EXPEDIENTE_NOMBRE),
    submission_type: candidate.WORKFLOW_DESCRIPCION || null,
    filing_reason: candidate.RAZON_INGRESO || null,
    titular_name: candidate.TITULAR || null,
    investment_amount: Number.isFinite(Number(candidate.INVERSION_MM)) ? Number(candidate.INVERSION_MM) : null,
    status: candidate.ESTADO_PROYECTO || null,
    filed_at: epochSecondsToIsoDate(candidate.FECHA_PRESENTACION),
    region: candidate.REGION_NOMBRE || null,
    comuna: candidate.COMUNA_NOMBRE || null,
    tipo_proyecto_code: candidate.TIPO_PROYECTO || null,
    descripcion_tipologia: candidate.DESCRIPCION_TIPOLOGIA || null,
    url_ficha: candidate.EXPEDIENTE_URL_FICHA || null,
    match_confidence: confidence,
    match_method: method,
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await client.from("seia_record").upsert(row, { onConflict: "seia_id" });
  if (error) throw new Error(`Error guardando match SEIA: ${error.message}`);

  // Event diffing: registrar cambios en el estado SEIA del proyecto
  const isFirstMatch = !previous;
  const sameRecordStatusChanged = previous?.seia_id === candidate.EXPEDIENTE_ID && previous.status !== candidate.ESTADO_PROYECTO;
  if (isFirstMatch || sameRecordStatusChanged) {
    // Event recording is a non-fatal side-effect: the seia_record upsert above already
    // succeeded, so a failure here (data_source lookup or the insert itself) must never
    // propagate and undo/mask that success — warn and continue instead.
    try {
      const dataSourceId = await getSeiaDataSourceId(client);
      const { error: eventError } = await client.from("project_event").insert({
        project_id: projectId,
        event_type: "seia_milestone",
        occurred_at: new Date().toISOString(),
        previous_value: previous ? JSON.stringify({ status: previous.status }) : null,
        new_value: JSON.stringify({ status: candidate.ESTADO_PROYECTO, expediente: candidate.EXPEDIENTE_NOMBRE }),
        data_source_id: dataSourceId,
        confidence_level: "PUBLICO",
        description: isFirstMatch
          ? `Expediente SEIA encontrado: "${candidate.EXPEDIENTE_NOMBRE}" (${candidate.ESTADO_PROYECTO})`
          : `Cambió el estado SEIA: "${previous?.status}" → "${candidate.ESTADO_PROYECTO}"`,
      });

      if (eventError) {
        console.warn(
          `[SEIA Match] Warning: Could not insert project_event for project ${projectId}: ${eventError.message}`,
        );
      }
    } catch (err) {
      console.warn(
        `[SEIA Match] Warning: Could not record project_event for project ${projectId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
