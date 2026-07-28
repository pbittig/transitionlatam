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

export interface OpportunityProjectOption {
  id: string;
  name: string;
  company: { id: string; name: string } | null;
  contacts: Array<{ id: string; name: string; role: string | null }>;
}

/** Opciones relacionadas para crear una oportunidad desde un proyecto real. */
export async function getOpportunityProjectOptions(client: SupabaseClient): Promise<OpportunityProjectOption[]> {
  const { data: projects, error: projectError } = await client
    .from("project")
    .select("id, name, updated_at, company:developer_company_id(id, name)")
    .not("verified_at", "is", null)
    .order("updated_at", { ascending: false })
    .limit(300);
  if (projectError) throw new Error(`Error obteniendo proyectos para CRM: ${projectError.message}`);

  const rows = (projects ?? []) as unknown as Array<{
    id: string;
    name: string;
    company: { id: string; name: string } | null;
  }>;
  if (!rows.length) return [];

  const projectIds = rows.map((project) => project.id);
  const companyIds = [...new Set(rows.map((project) => project.company?.id).filter((id): id is string => Boolean(id)))];
  const [{ data: projectRelations }, { data: companyRelations }] = await Promise.all([
    client
      .from("entity_relationship")
      .select("source_id, target_id, relationship_type")
      .eq("source_type", "person")
      .eq("target_type", "project")
      .in("target_id", projectIds),
    companyIds.length
      ? client
          .from("entity_relationship")
          .select("source_id, target_id, relationship_type")
          .eq("source_type", "person")
          .eq("target_type", "company")
          .in("target_id", companyIds)
      : Promise.resolve({ data: [] }),
  ]);

  const relations = [...(projectRelations ?? []), ...(companyRelations ?? [])] as Array<{
    source_id: string;
    target_id: string;
    relationship_type: string;
  }>;
  const personIds = [...new Set(relations.map((relation) => relation.source_id))];
  const { data: people } = personIds.length
    ? await client.from("person").select("id, full_name").in("id", personIds)
    : { data: [] };
  const peopleById = new Map((people ?? []).map((person) => [person.id as string, person.full_name as string]));

  return rows.map((project) => {
    const targetIds = new Set([project.id, project.company?.id].filter((id): id is string => Boolean(id)));
    const contactsById = new Map<string, { id: string; name: string; role: string | null }>();
    for (const relation of relations) {
      if (!targetIds.has(relation.target_id)) continue;
      const name = peopleById.get(relation.source_id);
      if (!name || contactsById.has(relation.source_id)) continue;
      contactsById.set(relation.source_id, {
        id: relation.source_id,
        name,
        role: relation.relationship_type?.replaceAll("_", " ") ?? null,
      });
    }
    return { ...project, contacts: [...contactsById.values()] };
  });
}

export async function getOpportunityBoard(client: SupabaseClient): Promise<OpportunityBoardItem[]> {
  const { data, error } = await client
    .from("opportunity")
    .select("id, stage, opportunity_type, description, owner_name, next_step, next_step_at, last_contacted_at, project:project_id(id, name, verified_at), company:company_id(id, name), person:person_id(id, full_name)")
    .order("next_step_at", { ascending: true, nullsFirst: false })
    .limit(100);
  // Hasta que se aplique la migración comercial, la tabla existente no tiene
  // las columnas de etapa y seguimiento. El CRM sigue abriendo con las
  // oportunidades históricas en la etapa inicial.
  if (error?.code === "PGRST204" || error?.code === "42703") {
    const { data: legacyData, error: legacyError } = await client
      .from("opportunity")
      .select("id, opportunity_type, description, project:project_id(id, name, verified_at)")
      .limit(100);
    if (legacyError) throw new Error(`Error obteniendo oportunidades: ${legacyError.message}`);
    return ((legacyData ?? []) as unknown as Array<{ id: string; opportunity_type: string | null; description: string | null; project: { id: string; name: string; verified_at: string | null } | null }>)
      .filter((item) => Boolean(item.project?.verified_at))
      .map((item) => ({
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
    project: { id: string; name: string; verified_at: string | null } | null; company: { id: string; name: string } | null; person: { id: string; full_name: string } | null;
  }>)
    .filter((item) => Boolean(item.project?.verified_at))
    .map((item) => ({
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
