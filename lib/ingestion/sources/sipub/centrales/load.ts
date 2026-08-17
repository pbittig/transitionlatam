import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedCentral } from "./types";

export interface CentralesLoadSummary {
  totalRows: number;
  upserted: number;
  /** Centrales que la CNE ya trae y por eso no se cargan de nuevo. */
  omitidasPorDuplicado: number;
}

const UPSERT_BATCH_SIZE = 200;

/** Mismo criterio que se usó para deduplicar a mano: sin tildes, sin espacios ni signos. */
function claveNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

/**
 * Nombres de las centrales que ya vienen de la CNE (las que tienen
 * `external_key`). Se paginan porque son ~1.245 y PostgREST corta en 1.000.
 */
async function nombresDeLaCne(client: SupabaseClient): Promise<Set<string>> {
  const nombres = new Set<string>();
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await client
      .from("power_plant")
      .select("name")
      .not("external_key", "is", null)
      .range(desde, desde + 999);
    if (error) throw new Error(`No se pudieron leer las centrales de la CNE: ${error.message}`);
    for (const fila of data ?? []) nombres.add(claveNombre(fila.name as string));
    if (!data || data.length < 1000) break;
  }
  return nombres;
}

/**
 * Carga las centrales del Coordinador, salvo las que la CNE ya trae.
 *
 * LA CNE MANDA en las centrales en operación: es el registro oficial de
 * capacidad instalada y su total cuadra con el del sistema. El Coordinador
 * aporta las que la CNE no lista —sobre todo las que están en construcción— y
 * atributos propios como el punto de conexión.
 *
 * Sin este filtro las dos fuentes cargaban la misma central dos veces y la
 * capacidad publicada quedaba inflada: 54.354 MW contra los 38.598 reales,
 * medido el 2026-08-17. Se omiten en vez de ocultarse porque ocultarlas dura
 * hasta la siguiente corrida — este sync volvería a marcarlas visibles con el
 * `is_hidden` que trae la fuente.
 */
export async function loadCentrales(
  client: SupabaseClient,
  centrales: NormalizedCentral[],
): Promise<CentralesLoadSummary> {
  const yaEnLaCne = await nombresDeLaCne(client);
  const propias = centrales.filter((c) => !yaEnLaCne.has(claveNombre(c.name)));
  const omitidasPorDuplicado = centrales.length - propias.length;

  const rows = propias.map((c) => ({
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

  return { totalRows: centrales.length, upserted, omitidasPorDuplicado };
}
