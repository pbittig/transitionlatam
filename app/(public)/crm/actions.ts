"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";
import { OPPORTUNITY_STAGES, type OpportunityStage } from "@/lib/data-access/opportunities";

async function getCrmActor() {
  if (await isAdmin()) {
    const client = createSupabaseServiceClient();
    const { data: organization } = await client
      .from("organization")
      .select("id")
      .eq("name", "Transition LATAM - Interno")
      .limit(1)
      .maybeSingle();
    if (!organization) throw new Error("La organización interna del CRM no está configurada.");
    return { client, organizationId: organization.id as string, profileId: null as string | null };
  }

  const client = await createSupabaseServerClient();
  const profile = await getCurrentUserProfile(client);
  if (!profile || profile.planCode !== "premium" || !profile.organizationId) throw new Error("Disponible en plan Prime.");
  return { client, organizationId: profile.organizationId, profileId: profile.id };
}

export interface CreateOpportunityState {
  error?: string;
}

export async function createOpportunity(
  _prevState: CreateOpportunityState | undefined,
  formData: FormData,
): Promise<CreateOpportunityState> {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const personId = String(formData.get("personId") ?? "").trim() || null;
  const opportunityType = String(formData.get("opportunityType") ?? "") || null;
  const description = String(formData.get("description") ?? "").trim();
  const ownerName = String(formData.get("ownerName") ?? "").trim() || null;
  const nextStep = String(formData.get("nextStep") ?? "").trim() || null;
  const nextStepAt = String(formData.get("nextStepAt") ?? "") || null;

  if (!projectId) {
    return { error: "Seleccione el proyecto relacionado con la oportunidad." };
  }
  if (!description) {
    return { error: "Describe brevemente el contexto comercial de la oportunidad." };
  }

  const actor = await getCrmActor();
  const client = actor.client;
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
    organization_id: actor.organizationId,
    created_by: actor.profileId,
  });
  if (error) {
    return { error: `No pudimos crear la oportunidad: ${error.message}` };
  }

  revalidatePath("/crm");
  return {};
}

export async function updateOpportunityStage(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const stage = String(formData.get("stage") ?? "") as OpportunityStage;
  if (!id || !OPPORTUNITY_STAGES.includes(stage)) throw new Error("Oportunidad o etapa inválida");

  const actor = await getCrmActor();
  const { error } = await actor.client
    .from("opportunity")
    .update({ stage, updated_at: new Date().toISOString(), last_contacted_at: stage === "reunion" ? new Date().toISOString().slice(0, 10) : undefined })
    .eq("id", id);
  if (error) throw new Error(`Error actualizando oportunidad: ${error.message}`);
  revalidatePath("/crm");
}

export async function updateOpportunity(formData: FormData) {
  const actor = await getCrmActor();
  const id = String(formData.get("id") ?? "").trim();
  const stage = String(formData.get("stage") ?? "") as OpportunityStage;
  const description = String(formData.get("description") ?? "").trim();
  const ownerName = String(formData.get("ownerName") ?? "").trim() || null;
  const personId = String(formData.get("personId") ?? "").trim() || null;
  const nextStep = String(formData.get("nextStep") ?? "").trim() || null;
  const nextStepAt = String(formData.get("nextStepAt") ?? "").trim() || null;
  if (!id || !description || !OPPORTUNITY_STAGES.includes(stage)) throw new Error("Completa los campos obligatorios.");

  const { data: current, error: currentError } = await actor.client
    .from("opportunity")
    .select("stage, project_id, company_id")
    .eq("id", id)
    .maybeSingle();
  if (currentError || !current) throw new Error("La oportunidad no está disponible.");

  if (personId) {
    const allowedTargets = [current.project_id, current.company_id].filter((value): value is string => Boolean(value));
    if (!allowedTargets.length) throw new Error("La oportunidad no tiene un proyecto o empresa vinculada.");
    const { data: relation } = await actor.client
      .from("entity_relationship")
      .select("id")
      .eq("source_type", "person")
      .eq("source_id", personId)
      .in("target_id", allowedTargets)
      .limit(1);
    if (!relation?.length) throw new Error("El contacto no está relacionado con este proyecto o empresa.");
  }

  const { error } = await actor.client.from("opportunity").update({
    stage,
    description,
    owner_name: ownerName,
    person_id: personId,
    next_step: nextStep,
    next_step_at: nextStepAt,
    last_contacted_at: stage === "reunion" && current.stage !== stage ? new Date().toISOString().slice(0, 10) : undefined,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw new Error(`No se pudo actualizar la oportunidad: ${error.message}`);

  if (current.stage !== stage) {
    const { error: activityError } = await actor.client.from("opportunity_activity").insert({
      opportunity_id: id,
      organization_id: actor.organizationId,
      created_by: actor.profileId,
      activity_type: "stage_change",
      note: `Etapa actualizada a ${stage.replaceAll("_", " ")}.`,
    });
    if (activityError) throw new Error(`La oportunidad se actualizó, pero no su historial: ${activityError.message}`);
  }
  revalidatePath("/crm");
}

export async function addOpportunityActivity(formData: FormData) {
  const actor = await getCrmActor();
  const opportunityId = String(formData.get("opportunityId") ?? "").trim();
  const activityType = String(formData.get("activityType") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const occurredAt = String(formData.get("occurredAt") ?? "").trim();
  if (!opportunityId || !note || !["note", "call", "meeting", "email"].includes(activityType)) {
    throw new Error("Completa el tipo y el detalle de la actividad.");
  }
  const { error } = await actor.client.from("opportunity_activity").insert({
    opportunity_id: opportunityId,
    organization_id: actor.organizationId,
    created_by: actor.profileId,
    activity_type: activityType,
    note,
    occurred_at: occurredAt ? new Date(`${occurredAt}T12:00:00`).toISOString() : new Date().toISOString(),
  });
  if (error) throw new Error(`No se pudo registrar la actividad: ${error.message}`);
  revalidatePath("/crm");
}
