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
    revalidatePath("/proyectos-esperados");
    revalidatePath("/crm");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
