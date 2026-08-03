"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { createProjectOpportunity } from "@/lib/data-access/crmOpportunities";

/** Agrega un proyecto al CRM como oportunidad nueva en etapa "Contacto" — requiere sesión de admin. */
export async function addProjectToOpportunity(
  projectId: string,
  projectName: string,
  developerCompanyId: string | null,
): Promise<{ success: boolean; error?: string }> {
  if (!(await isAdmin())) {
    return { success: false, error: "Debes iniciar sesión como administrador." };
  }
  try {
    await createProjectOpportunity(createSupabaseServiceClient(), { projectId, projectName, developerCompanyId });
    revalidatePath(`/proyectos/${projectId}`);
    revalidatePath("/proyectos");
    revalidatePath("/crm");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/** Desactiva un proyecto del CRM cerrando sus oportunidades activas, sin borrar el historial. */
export async function deactivateProjectFromCrm(
  projectId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!(await isAdmin())) {
    return { success: false, error: "Debes iniciar sesión como administrador." };
  }
  try {
    const { error } = await createSupabaseServiceClient()
      .from("opportunity")
      .update({ stage: "cierre_perdido", updated_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .not("stage", "in", "(cierre_ganado,cierre_perdido)");
    if (error) throw new Error(error.message);
    revalidatePath(`/proyectos/${projectId}`);
    revalidatePath("/proyectos");
    revalidatePath("/crm");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
