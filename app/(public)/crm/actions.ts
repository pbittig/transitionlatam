"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { OPPORTUNITY_STAGES, type OpportunityStage } from "@/lib/data-access/opportunities";

export interface CreateOpportunityState {
  error?: string;
}

export async function createOpportunity(
  _prevState: CreateOpportunityState | undefined,
  formData: FormData,
): Promise<CreateOpportunityState> {
  if (!(await isAdmin())) throw new Error("No autorizado");

  const projectId = String(formData.get("projectId") ?? "").trim();
  const personId = String(formData.get("personId") ?? "").trim() || null;
  const opportunityType = String(formData.get("opportunityType") ?? "") || null;
  const description = String(formData.get("description") ?? "").trim();
  const ownerName = String(formData.get("ownerName") ?? "").trim() || null;
  const nextStep = String(formData.get("nextStep") ?? "").trim() || null;
  const nextStepAt = String(formData.get("nextStepAt") ?? "") || null;

  if (!projectId) {
    return { error: "Selecciona el proyecto relacionado con la oportunidad." };
  }
  if (!description) {
    return { error: "Describe brevemente el contexto comercial de la oportunidad." };
  }

  const client = createSupabaseServiceClient();
  const { data: project, error: projectError } = await client
    .from("project")
    .select("id, developer_company_id, verified_at")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError || !project) return { error: "El proyecto seleccionado ya no está disponible." };
  if (!project.verified_at) return { error: "El CRM sólo admite proyectos verificados." };

  let companyId = project.developer_company_id as string | null;
  if (!companyId) {
    const { data: developedBy } = await client
      .from("entity_relationship")
      .select("target_id")
      .eq("source_type", "project")
      .eq("source_id", projectId)
      .eq("relationship_type", "developed_by")
      .eq("target_type", "company")
      .limit(1)
      .maybeSingle();
    companyId = developedBy?.target_id as string | null ?? null;
  }

  if (personId) {
    const projectTargets = [projectId, companyId].filter((id): id is string => Boolean(id));
    const { data: allowedRelations } = await client
      .from("entity_relationship")
      .select("id")
      .eq("source_type", "person")
      .eq("source_id", personId)
      .in("target_id", projectTargets)
      .limit(1);
    if (!allowedRelations?.length) {
      return { error: "El contacto seleccionado no está relacionado con este proyecto o su empresa." };
    }
  }

  const { error } = await client.from("opportunity").insert({
    project_id: projectId,
    company_id: companyId,
    person_id: personId,
    opportunity_type: opportunityType,
    description,
    owner_name: ownerName,
    next_step: nextStep,
    next_step_at: nextStepAt,
    stage: "contacto",
    confidence_level: "INTELIGENCIA_DE_MERCADO",
  });
  if (error) {
    return { error: `No pudimos crear la oportunidad: ${error.message}` };
  }

  revalidatePath("/crm");
  return {};
}

export async function updateOpportunityStage(formData: FormData) {
  if (!(await isAdmin())) throw new Error("No autorizado");
  const id = String(formData.get("id") ?? "");
  const stage = String(formData.get("stage") ?? "") as OpportunityStage;
  if (!id || !OPPORTUNITY_STAGES.includes(stage)) throw new Error("Oportunidad o etapa inválida");

  const { error } = await createSupabaseServiceClient()
    .from("opportunity")
    .update({ stage, updated_at: new Date().toISOString(), last_contacted_at: stage === "reunion" ? new Date().toISOString().slice(0, 10) : undefined })
    .eq("id", id);
  if (error) throw new Error(`Error actualizando oportunidad: ${error.message}`);
  revalidatePath("/crm");
}
