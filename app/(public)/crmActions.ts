"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";
import { createProjectOpportunity } from "@/lib/data-access/crmOpportunities";

async function getActor() {
  if (await isAdmin()) {
    const client = createSupabaseServiceClient();
    const { data } = await client.from("organization").select("id").eq("name", "Transition LATAM - Interno").limit(1).maybeSingle();
    if (!data) throw new Error("La organización interna no está configurada.");
    return { client, organizationId: data.id as string, profileId: null as string | null };
  }
  const client = await createSupabaseServerClient();
  const profile = await getCurrentUserProfile(client);
  if (!profile || profile.planCode !== "premium" || !profile.organizationId) throw new Error("Disponible en plan Prime.");
  return { client, organizationId: profile.organizationId, profileId: profile.id };
}

export async function addProjectToOpportunity(projectId: string, projectName: string, developerCompanyId: string | null): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await getActor();
    await createProjectOpportunity(actor.client, {
      projectId, projectName, developerCompanyId,
      organizationId: actor.organizationId,
      createdBy: actor.profileId,
    });
    revalidatePath(`/proyectos/${projectId}`);
    revalidatePath("/proyectos");
    revalidatePath("/crm");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deactivateProjectFromCrm(projectId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await getActor();
    const { error } = await actor.client
      .from("opportunity")
      .update({ stage: "cierre_perdido", updated_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .not("stage", "in", "(cierre_ganado,cierre_perdido)");
    if (error) throw new Error(error.message);
    revalidatePath(`/proyectos/${projectId}`);
    revalidatePath("/proyectos");
    revalidatePath("/crm");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
