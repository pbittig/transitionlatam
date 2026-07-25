import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubstationAggregate } from "./types";

const BATCH_SIZE = 200;

export async function loadSubstations(client: SupabaseClient, substations: SubstationAggregate[]): Promise<number> {
  const rows = substations.map((s) => ({
    name: s.name,
    name_normalized: s.nameNormalized,
    owner_name: s.ownerName,
    transformer_count: s.transformerCount,
    total_capacity_mva: s.totalCapacityMva,
    voltage_levels: s.voltageLevels,
    synced_at: new Date().toISOString(),
  }));

  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await client.from("substation").upsert(batch, { onConflict: "name_normalized" });
    if (error) throw new Error(`Error al cargar substation (batch ${i}): ${error.message}`);
    upserted += batch.length;
  }
  return upserted;
}
