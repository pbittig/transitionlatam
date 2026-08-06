import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type OwnershipEntityType = "company" | "person" | "foreign_company";

export interface OwnershipEntity {
  id: string;
  legalName: string;
  rut: string | null;
  entityType: OwnershipEntityType;
  countryCode: string | null;
}

export interface OwnershipRelation {
  ownerEntityId: string;
  ownedEntityId: string;
  ownershipPercent: number;
}

export interface ProjectOwnershipMap {
  spvEntityId: string;
  coverageStatus: "complete" | "partial";
  sourceLabel: string;
  sourceDate: string | null;
  entities: OwnershipEntity[];
  relations: OwnershipRelation[];
}

export async function getProjectOwnershipMap(
  client: SupabaseClient,
  projectId: string,
): Promise<ProjectOwnershipMap | null> {
  const { data: profile, error: profileError } = await client
    .from("project_ownership_profile")
    .select("spv_entity_id,coverage_status,source_label,source_date")
    .eq("project_id", projectId)
    .maybeSingle();
  if (profileError) throw new Error(`Error obteniendo propiedad del proyecto: ${profileError.message}`);
  if (!profile) return null;

  const entities = new Map<string, OwnershipEntity>();
  const relations = new Map<string, OwnershipRelation>();
  let frontier = [profile.spv_entity_id as string];
  const visited = new Set<string>();

  while (frontier.length > 0) {
    const current = frontier.filter((id) => !visited.has(id));
    if (current.length === 0) break;
    current.forEach((id) => visited.add(id));

    const [{ data: entityRows, error: entityError }, { data: relationRows, error: relationError }] = await Promise.all([
      client.from("ownership_entity").select("id,legal_name,rut,entity_type,country_code").in("id", current),
      client.from("ownership_relation").select("owner_entity_id,owned_entity_id,ownership_percent").in("owned_entity_id", current),
    ]);
    if (entityError) throw new Error(`Error obteniendo entidades propietarias: ${entityError.message}`);
    if (relationError) throw new Error(`Error obteniendo relaciones propietarias: ${relationError.message}`);

    for (const row of entityRows ?? []) {
      entities.set(row.id as string, {
        id: row.id as string,
        legalName: row.legal_name as string,
        rut: row.rut as string | null,
        entityType: row.entity_type as OwnershipEntityType,
        countryCode: row.country_code as string | null,
      });
    }
    frontier = [];
    for (const row of relationRows ?? []) {
      const relation = {
        ownerEntityId: row.owner_entity_id as string,
        ownedEntityId: row.owned_entity_id as string,
        ownershipPercent: Number(row.ownership_percent),
      };
      relations.set(`${relation.ownerEntityId}:${relation.ownedEntityId}`, relation);
      frontier.push(relation.ownerEntityId);
    }
  }

  // The last frontier consists of controllers, which were not loaded in the
  // preceding iteration if they own no other entity in that batch.
  const missingIds = [...visited].filter((id) => !entities.has(id));
  if (missingIds.length > 0) {
    const { data, error } = await client
      .from("ownership_entity")
      .select("id,legal_name,rut,entity_type,country_code")
      .in("id", missingIds);
    if (error) throw new Error(`Error obteniendo controladores finales: ${error.message}`);
    for (const row of data ?? []) {
      entities.set(row.id as string, {
        id: row.id as string,
        legalName: row.legal_name as string,
        rut: row.rut as string | null,
        entityType: row.entity_type as OwnershipEntityType,
        countryCode: row.country_code as string | null,
      });
    }
  }

  return {
    spvEntityId: profile.spv_entity_id as string,
    coverageStatus: profile.coverage_status as "complete" | "partial",
    sourceLabel: profile.source_label as string,
    sourceDate: profile.source_date as string | null,
    entities: [...entities.values()],
    relations: [...relations.values()],
  };
}

