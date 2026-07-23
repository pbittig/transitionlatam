import type { SupabaseClient } from "@supabase/supabase-js";
import { OPPORTUNITY_STAGES, OPPORTUNITY_STAGE_LABEL, type OpportunityStage } from "@/lib/shared/opportunityStages";

export { OPPORTUNITY_STAGES, OPPORTUNITY_STAGE_LABEL, type OpportunityStage };

export interface OpportunityBoardItem {
  id: string;
  stage: OpportunityStage;
  type: string | null;
  description: string | null;
  ownerName: string | null;
  nextStep: string | null;
  nextStepAt: string | null;
  lastContactedAt: string | null;
  project: { id: string; name: string } | null;
  company: { id: string; name: string } | null;
  person: { id: string; name: string } | null;
}

export async function getOpportunityBoard(client: SupabaseClient): Promise<OpportunityBoardItem[]> {
  const { data, error } = await client
    .from("opportunity")
    .select("id, stage, opportunity_type, description, owner_name, next_step, next_step_at, last_contacted_at, project:project_id(id, name), company:company_id(id, name), person:person_id(id, full_name)")
    .not("stage", "in", "(cierre_ganado,cierre_perdido)")
    .order("next_step_at", { ascending: true, nullsFirst: false })
    .limit(100);
  // Hasta que se aplique la migración comercial, la tabla existente no tiene
  // las columnas de etapa y seguimiento. El CRM sigue abriendo con las
  // oportunidades históricas en la etapa inicial.
  if (error?.code === "PGRST204" || error?.code === "42703") {
    const { data: legacyData, error: legacyError } = await client
      .from("opportunity")
      .select("id, opportunity_type, description, project:project_id(id, name)")
      .limit(100);
    if (legacyError) throw new Error(`Error obteniendo oportunidades: ${legacyError.message}`);
    return ((legacyData ?? []) as unknown as Array<{ id: string; opportunity_type: string | null; description: string | null; project: { id: string; name: string } | null }>).map((item) => ({
      id: item.id,
      stage: "contacto",
      type: item.opportunity_type,
      description: item.description,
      ownerName: null,
      nextStep: null,
      nextStepAt: null,
      lastContactedAt: null,
      project: item.project,
      company: null,
      person: null,
    }));
  }
  if (error) throw new Error(`Error obteniendo oportunidades: ${error.message}`);

  return ((data ?? []) as unknown as Array<{
    id: string; stage: OpportunityStage; opportunity_type: string | null; description: string | null; owner_name: string | null;
    next_step: string | null; next_step_at: string | null; last_contacted_at: string | null;
    project: { id: string; name: string } | null; company: { id: string; name: string } | null; person: { id: string; full_name: string } | null;
  }>).map((item) => ({
    id: item.id,
    stage: item.stage,
    type: item.opportunity_type,
    description: item.description,
    ownerName: item.owner_name,
    nextStep: item.next_step,
    nextStepAt: item.next_step_at,
    lastContactedAt: item.last_contacted_at,
    project: item.project,
    company: item.company,
    person: item.person ? { id: item.person.id, name: item.person.full_name } : null,
  }));
}
