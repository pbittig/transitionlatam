// lib/data-access/crmOpportunities.ts
// Puente entre un `project` y el CRM comercial (tabla opportunity) — separado
// de lib/data-access/opportunities.ts porque ese archivo es sobre el tablero
// (leer/agrupar oportunidades existentes); este es sobre engancharlas a un
// proyecto puntual desde la ficha o la tabla de Proyectos futuros.
import type { SupabaseClient } from "@supabase/supabase-js";
import { CLOSED_STAGES } from "@/lib/shared/opportunityStages";

/**
 * Para un lote de proyectos (ej. los 20 de una página de tabla), cuáles ya
 * tienen una oportunidad en una etapa no cerrada — evita un N+1 (una consulta
 * por fila) y evita mostrar "Agregar al CRM" para un proyecto que ya está.
 */
export async function getActiveOpportunityProjectIds(client: SupabaseClient, projectIds: string[]): Promise<Set<string>> {
  if (projectIds.length === 0) return new Set();
  const { data, error } = await client
    .from("opportunity")
    .select("project_id")
    .in("project_id", projectIds)
    .not("stage", "in", `(${CLOSED_STAGES.join(",")})`);
  if (error) throw new Error(`Error revisando oportunidades activas: ${error.message}`);
  return new Set((data ?? []).map((r) => r.project_id as string).filter((id): id is string => id !== null));
}

/** Alta rápida de un click — ver AddToCrmButton.tsx. Etapa inicial fija: "contacto". */
export async function createProjectOpportunity(
  client: SupabaseClient,
  args: { projectId: string; projectName: string; developerCompanyId: string | null },
): Promise<void> {
  const { error } = await client.from("opportunity").insert({
    project_id: args.projectId,
    company_id: args.developerCompanyId,
    stage: "contacto",
    description: `Proyecto: ${args.projectName}`,
    confidence_level: "INTELIGENCIA_DE_MERCADO",
  });
  if (error) throw new Error(`Error agregando proyecto al CRM: ${error.message}`);
}
