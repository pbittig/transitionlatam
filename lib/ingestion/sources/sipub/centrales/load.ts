import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedCentral } from "./types";

export interface CentralesLoadSummary {
  totalRows: number;
  upserted: number;
}

const UPSERT_BATCH_SIZE = 200;

export async function loadCentrales(
  client: SupabaseClient,
  centrales: NormalizedCentral[],
): Promise<CentralesLoadSummary> {
  const rows = centrales.map((c) => ({
    id_central: c.idCentral,
    name: c.name,
    owner_name: c.ownerName,
    plant_type: c.plantType,
    technology_detail: c.technologyDetail,
    energy_conversion: c.energyConversion,
    is_renewable: c.isRenewable,
    status: c.status,
    installation_code: c.installationCode,
    connection_point: c.connectionPoint,
    gross_max_power_mw: c.grossMaxPowerMw,
    net_capacity_mw: c.netCapacityMw,
    min_technical_power_mw: c.minTechnicalPowerMw,
    own_consumption_mw: c.ownConsumptionMw,
    unit_count: c.unitCount,
    operation_start_date: c.operationStartDate,
    region: c.region,
    provincia: c.provincia,
    comuna: c.comuna,
    utm_zone: c.utmZone,
    utm_east: c.utmEast,
    utm_north: c.utmNorth,
    latitude: c.latitude,
    longitude: c.longitude,
    is_hidden: c.isHidden,
    synced_at: new Date().toISOString(),
  }));

  let upserted = 0;
  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await client.from("power_plant").upsert(batch, { onConflict: "id_central" });
    if (error) throw new Error(`Error al cargar power_plant (batch ${i}): ${error.message}`);
    upserted += batch.length;
  }

  return { totalRows: centrales.length, upserted };
}
