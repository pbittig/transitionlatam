"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { TECHNOLOGY_COMBOS, type TechnologyCombo } from "./technologyCombos";
import { reprocessFormularioContacts } from "@/lib/ingestion/sources/energia-abierta/detalle-formulario/reprocess";

export type EditableProjectField =
  | "name"
  | "capacityMw"
  | "capacityMwh"
  | "generationCapacityMw"
  | "storageCapacityMw"
  | "storageHours"
  | "status"
  | "estimatedConnectionDate"
  | "nup"
  | "developerCompanyRut"
  | "developerCompanyAddress"
  | "spvName"
  | "connectionPoint"
  | "voltageLevel"
  | "requestType";

const PROJECT_COLUMNS: Partial<Record<EditableProjectField, string>> = {
  name: "name",
  capacityMw: "capacity_mw",
  capacityMwh: "capacity_mwh",
  generationCapacityMw: "generation_capacity_mw",
  storageCapacityMw: "storage_capacity_mw",
  storageHours: "storage_hours",
  status: "status",
  estimatedConnectionDate: "estimated_connection_date",
  nup: "nup",
};

const COMPANY_COLUMNS: Partial<Record<EditableProjectField, string>> = {
  developerCompanyRut: "rut",
  developerCompanyAddress: "legal_address",
};

const SPV_COLUMNS: Partial<Record<EditableProjectField, string>> = {
  spvName: "name",
};

const CONNECTION_COLUMNS: Partial<Record<EditableProjectField, string>> = {
  connectionPoint: "connection_point",
  voltageLevel: "voltage_level",
  requestType: "request_type",
};

/**
 * Auto-save por campo desde ProjectEditForm — escribe en la tabla que
 * corresponda según el campo (project / company / spv / project_connection).
 * `field` está tipado a EditableProjectField, así que el whitelist de arriba
 * es exhaustivo: nunca se interpola un nombre de columna que no esté en una
 * de las cuatro listas.
 */
export async function updateProjectField(
  projectId: string,
  field: EditableProjectField,
  value: string | number | null,
): Promise<{ success: boolean; error?: string }> {
  if (!(await isAdmin())) {
    return { success: false, error: "Debes iniciar sesión como administrador." };
  }

  try {
    const client = createSupabaseServiceClient();

    if (PROJECT_COLUMNS[field]) {
      // Capacidad (MW) y Potencia de generación (MW) se unificaron en una sola celda
      // en el formulario (eran el mismo dato mostrado dos veces para híbridos) —
      // se espejan acá para que ningún código que todavía lea generation_capacity_mw
      // (ficha pública, listado) quede desincronizado.
      const patch: Record<string, string | number | null> = { [PROJECT_COLUMNS[field]!]: value };
      if (field === "capacityMw") patch.generation_capacity_mw = value;

      // MW × horas = MWh es un cálculo exacto (no una estimación) una vez que se
      // conocen ambos — se completa solo mientras el admin no haya puesto un valor
      // propio en Energía (MWh); si ya hay uno, se respeta y no se pisa.
      if (field === "storageCapacityMw" || field === "storageHours") {
        const { data: current } = await client
          .from("project")
          .select("storage_capacity_mw, storage_hours, capacity_mwh")
          .eq("id", projectId)
          .maybeSingle();
        if (current && current.capacity_mwh === null) {
          const mw = field === "storageCapacityMw" ? (value as number | null) : current.storage_capacity_mw;
          const hours = field === "storageHours" ? (value as number | null) : current.storage_hours;
          if (mw !== null && hours !== null) patch.capacity_mwh = Number(mw) * Number(hours);
        }
      }

      const { error } = await client.from("project").update(patch).eq("id", projectId);
      if (error) throw new Error(error.message);
    } else if (COMPANY_COLUMNS[field]) {
      const { data: projectRow, error: projectError } = await client
        .from("project")
        .select("developer_company_id")
        .eq("id", projectId)
        .maybeSingle();
      if (projectError) throw new Error(projectError.message);
      if (!projectRow?.developer_company_id) {
        return { success: false, error: "Este proyecto no tiene empresa desarrolladora asociada todavía." };
      }
      const { error } = await client
        .from("company")
        .update({ [COMPANY_COLUMNS[field]!]: value })
        .eq("id", projectRow.developer_company_id as string);
      if (error) throw new Error(error.message);
    } else if (SPV_COLUMNS[field]) {
      const { data: projectRow, error: projectError } = await client
        .from("project")
        .select("spv_id")
        .eq("id", projectId)
        .maybeSingle();
      if (projectError) throw new Error(projectError.message);

      if (!projectRow?.spv_id) {
        // Sin SPV vinculada todavía: a diferencia de la empresa desarrolladora (que sí se
        // repite entre proyectos), la SPV es prácticamente 1 a 1 con el proyecto en este
        // rubro — crear una nueva acá no arriesga duplicar algo que ya existía en otro lado.
        if (value === null || value === "") return { success: true };
        const { data: newSpv, error: createError } = await client.from("spv").insert({ name: value }).select("id").single();
        if (createError) throw new Error(createError.message);
        const { error: linkError } = await client.from("project").update({ spv_id: newSpv.id }).eq("id", projectId);
        if (linkError) throw new Error(linkError.message);
      } else {
        const { error } = await client
          .from("spv")
          .update({ [SPV_COLUMNS[field]!]: value })
          .eq("id", projectRow.spv_id as string);
        if (error) throw new Error(error.message);
      }
    } else if (CONNECTION_COLUMNS[field]) {
      const { error } = await client
        .from("project_connection")
        .update({ [CONNECTION_COLUMNS[field]!]: value })
        .eq("project_id", projectId);
      if (error) throw new Error(error.message);
    } else {
      return { success: false, error: "Campo no editable." };
    }

    revalidatePath(`/admin/verificador/${projectId}`);
    revalidatePath(`/admin/editar-data/${projectId}`);
    revalidatePath(`/proyectos/${projectId}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/** Marca un proyecto como verificado (sale de la cola para siempre) — el botón de la UI redirige a la lista de la cola, no a un proyecto específico. */
export async function markProjectVerified(projectId: string): Promise<{ success: boolean; error?: string }> {
  if (!(await isAdmin())) {
    return { success: false, error: "Debes iniciar sesión como administrador." };
  }
  try {
    const client = createSupabaseServiceClient();
    const now = new Date().toISOString();
    const { error } = await client
      .from("project")
      .update({
        verified_at: now,
        editorial_status: "published",
        editorial_reviewed_at: now,
        published_at: now,
      })
      .eq("id", projectId);
    if (error) throw new Error(error.message);

    // Contactos frescos al momento de verificar — así queda con la lógica de
    // validación vigente (isPlausiblePhone/isPlaceholderContact, ver
    // detalle-formulario/load.ts) sin depender de una corrida manual aparte.
    // Programado con after() en vez de esperado: cuando el Formulario original
    // es un PDF, esto pasa por IA (NVIDIA NIM) que en el tier gratuito puede
    // demorar mucho o fallar (hallazgo real: clicks en "Verificado" tardando
    // 8-84s+ porque el botón esperaba esto antes de responder). No bloquea la
    // verificación si falla — se registra el error pero el proyecto queda
    // verificado igual.
    after(async () => {
      const reprocess = await reprocessFormularioContacts(client, projectId);
      if (!reprocess.success) {
        console.warn(`No se pudieron refrescar los contactos de ${projectId} al verificar: ${reprocess.error}`);
      }
    });

    revalidatePath("/admin/verificador");
    revalidatePath("/admin/trabajo-hoy");
    revalidatePath("/");
    revalidatePath("/proyectos");
    revalidatePath(`/admin/editar-data/${projectId}`);
    revalidatePath(`/proyectos/${projectId}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Desvincula el expediente SEIA asociado a este proyecto (deja `project_id` en null en
 * `seia_record`) — mismo mecanismo que ya usa saveSeiaMatch para soltar un match previo
 * distinto antes de asociar uno nuevo, aquí sin candidato nuevo. Es solo una
 * desvinculación, no una marca de "no aplica EIA/DIA": una corrida futura de
 * scripts/match-seia-projects.ts podría volver a sugerirle algo a este proyecto
 * (decisión confirmada con el usuario, ver el spec de esta feature).
 */
export async function unassignSeiaMatch(projectId: string): Promise<{ success: boolean; error?: string }> {
  if (!(await isAdmin())) {
    return { success: false, error: "Debes iniciar sesión como administrador." };
  }
  try {
    const client = createSupabaseServiceClient();
    const { error } = await client.from("seia_record").update({ project_id: null }).eq("project_id", projectId);
    if (error) throw new Error(error.message);

    revalidatePath(`/admin/verificador/${projectId}`);
    revalidatePath(`/admin/editar-data/${projectId}`);
    revalidatePath(`/proyectos/${projectId}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Elimina un proyecto y todo lo que cuelga de él (permanente, sin deshacer).
 * La mayoría de las tablas relacionadas (project_connection, seia_record,
 * project_event, opportunity, followed_project) tienen `on delete cascade`
 * en `project_id` y se limpian solas; `formulario_ingest_log` es la única
 * excepción (su FK no tiene cascade), así que se borra primero a mano.
 */
export async function deleteProject(projectId: string): Promise<{ success: boolean; error?: string }> {
  if (!(await isAdmin())) {
    return { success: false, error: "Debes iniciar sesión como administrador." };
  }
  try {
    const client = createSupabaseServiceClient();
    const { error: formularioError } = await client.from("formulario_ingest_log").delete().eq("project_id", projectId);
    if (formularioError) throw new Error(formularioError.message);

    const { error } = await client.from("project").delete().eq("id", projectId);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/verificador");
    revalidatePath("/admin/editar-data");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Fija tecnología + includes_storage + project_kind a la vez, a partir de un combo elegido
 * en el select de ProjectEditForm (ver ./technologyCombos.ts) — las tres columnas juntas
 * determinan qué celdas de capacidad tienen sentido para este proyecto, así que se
 * escriben en un solo paso en vez de exponerlas como tres campos sueltos.
 */
export async function updateProjectTechnologyCombo(
  projectId: string,
  combo: TechnologyCombo,
): Promise<{ success: boolean; error?: string }> {
  if (!(await isAdmin())) {
    return { success: false, error: "Debes iniciar sesión como administrador." };
  }
  try {
    const client = createSupabaseServiceClient();
    const config = TECHNOLOGY_COMBOS[combo];

    const { data: existingTech, error: techError } = await client
      .from("technology")
      .select("id")
      .eq("code", config.technologyCode)
      .limit(1)
      .maybeSingle();
    if (techError) throw new Error(techError.message);

    let technologyId = existingTech?.id as string | undefined;
    if (!technologyId) {
      const { data: createdTech, error: createTechError } = await client
        .from("technology")
        .insert({ code: config.technologyCode, name: config.label })
        .select("id")
        .single();
      if (createTechError) throw new Error(createTechError.message);
      technologyId = createdTech.id as string;
    }

    const { error } = await client
      .from("project")
      .update({ technology_id: technologyId, includes_storage: config.includesStorage, project_kind: config.projectKind })
      .eq("id", projectId);
    if (error) throw new Error(error.message);

    revalidatePath(`/admin/verificador/${projectId}`);
    revalidatePath(`/admin/editar-data/${projectId}`);
    revalidatePath(`/proyectos/${projectId}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
