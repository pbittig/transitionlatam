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

  const opportunityType = String(formData.get("opportunityType") ?? "") || null;
  const description = String(formData.get("description") ?? "").trim();
  const ownerName = String(formData.get("ownerName") ?? "").trim() || null;
  const nextStep = String(formData.get("nextStep") ?? "").trim() || null;
  const nextStepAt = String(formData.get("nextStepAt") ?? "") || null;

  if (!description) {
    return { error: "Describe la oportunidad (empresa, contexto, contacto)." };
  }

  const { error } = await createSupabaseServiceClient().from("opportunity").insert({
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
