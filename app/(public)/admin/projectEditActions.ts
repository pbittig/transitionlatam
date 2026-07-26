"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { getVerificationQueue } from "@/lib/data-access/projects";

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
      const { error } = await client.from("project").update({ [PROJECT_COLUMNS[field]!]: value }).eq("id", projectId);
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
        return { success: false, error: "Este proyecto no tiene SPV asociada todavía." };
      }
      const { error } = await client
        .from("spv")
        .update({ [SPV_COLUMNS[field]!]: value })
        .eq("id", projectRow.spv_id as string);
      if (error) throw new Error(error.message);
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

/**
 * Marca un proyecto como verificado (sale de la cola para siempre) y
 * devuelve el id del siguiente proyecto pendiente para que el botón de la UI
 * pueda redirigir directo a él — ver spec: "redirige automáticamente al
 * siguiente proyecto pendiente".
 */
export async function markProjectVerified(
  projectId: string,
): Promise<{ success: boolean; nextProjectId?: string | null; error?: string }> {
  if (!(await isAdmin())) {
    return { success: false, error: "Debes iniciar sesión como administrador." };
  }
  try {
    const client = createSupabaseServiceClient();
    const { error } = await client.from("project").update({ verified_at: new Date().toISOString() }).eq("id", projectId);
    if (error) throw new Error(error.message);

    const queue = await getVerificationQueue(client, 1);
    revalidatePath("/admin/verificador");
    revalidatePath(`/admin/editar-data/${projectId}`);
    return { success: true, nextProjectId: queue[0]?.id ?? null };
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
