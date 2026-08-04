import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * `plant_type` (columna propia, sin embed) y `namePatterns` (heurística, ver ADR-019)
 * se combinan con OR cuando ambos están activos — ej. chips "Solar" + "BESS" a la vez.
 * Tipado laxo a propósito: el tipo real de un query builder de PostgREST encadenado
 * es demasiado específico por método para expresar genéricamente aquí sin fragilidad
 * de versión; el contrato (recibe y devuelve el mismo builder) importa, no la forma exacta.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyPlantTypeAndNameFilter(query: any, plantTypes: string[], namePatterns: string[]): any {
  const hasType = plantTypes.length > 0;
  const hasName = namePatterns.length > 0;
  if (hasType && hasName) {
    return query.or([`plant_type.in.(${plantTypes.join(",")})`, ...namePatterns.map((p) => `name.ilike.%${p}%`)].join(","));
  }
  if (hasType) {
    return plantTypes.length === 1 ? query.eq("plant_type", plantTypes[0]) : query.in("plant_type", plantTypes);
  }
  if (hasName) {
    return query.or(namePatterns.map((p) => `name.ilike.%${p}%`).join(","));
  }
  return query;
}

export interface PowerPlantStats {
  totalPlants: number;
  operatingCapacityMw: number;
  renewableCapacityMw: number;
  underConstructionCount: number;
  underConstructionCapacityMw: number;
  byTechnology: Array<{ technology: string; count: number; capacityMw: number }>;
  byStatus: Array<{ status: string; count: number; capacityMw: number }>;
  topOwners: Array<{ owner: string; plantCount: number; capacityMw: number }>;
  /** Índice Herfindahl-Hirschman (0-10000) de concentración de mercado por capacidad instalada. */
  marketConcentrationIndex: number;
}

/** Marca de tiempo real de la última sincronización del registro de centrales (ver ADR-019). */
export async function getLastSyncTimestamp(client: SupabaseClient): Promise<string | null> {
  const { data, error } = await client.from("power_plant").select("synced_at").order("synced_at", { ascending: false }).limit(1);
  if (error) throw new Error(`Error al leer última sincronización: ${error.message}`);
  return data?.[0]?.synced_at ?? null;
}

export async function getLatestCapacitySourceDate(client: SupabaseClient): Promise<string | null> {
  const { data, error } = await client
    .from("cne_capacidad_sync_log")
    .select("fecha_act")
    .order("fecha_act", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Error al leer la fecha de corte CNE: ${error.message}`);
  return data?.fecha_act ?? null;
}

export async function getPowerPlantStats(client: SupabaseClient): Promise<PowerPlantStats> {
  const { data, error } = await client.rpc("get_power_plant_stats");
  if (error) throw new Error(`Error al leer get_power_plant_stats: ${error.message}`);
  return data as PowerPlantStats;
}

export interface PowerPlantRegionBubble {
  region: string;
  capacityMw: number;
  plantCount: number;
  dominantTechnology: string;
}

/** Cruce Región × Capacidad × Cantidad × Tecnología dominante — para el gráfico de burbujas de Data SEN. */
export async function getPowerPlantRegionBubbles(client: SupabaseClient): Promise<PowerPlantRegionBubble[]> {
  const { data, error } = await client.rpc("get_power_plant_region_bubbles");
  if (error) throw new Error(`Error al leer get_power_plant_region_bubbles: ${error.message}`);
  return (data ?? []).map((r: { region: string; capacity_mw: number; plant_count: number; dominant_technology: string }) => ({
    region: r.region,
    capacityMw: r.capacity_mw,
    plantCount: r.plant_count,
    dominantTechnology: r.dominant_technology,
  }));
}

export interface PowerPlantMapPoint {
  id: number;
  name: string;
  ownerName: string | null;
  technologyDetail: string | null;
  plantType: string | null;
  status: string | null;
  capacityMw: number | null;
  lat: number;
  lng: number;
}

// Filtro conservador para el Chile continental. La fuente contiene algunas
// coordenadas evidentemente erróneas en el Pacífico o al este de la frontera.
// Los límites se interpolan por latitud para seguir la forma larga y angosta
// del país sin aceptar un rectángulo que incluiría buena parte de Argentina.
const CHILE_LONGITUDE_CORRIDOR = [
  { lat: -17.5, west: -70.45, east: -68.8 },
  { lat: -20, west: -70.25, east: -68.4 },
  { lat: -23, west: -70.65, east: -67.9 },
  { lat: -26, west: -70.85, east: -68.3 },
  { lat: -30, west: -71.55, east: -69.2 },
  { lat: -32, west: -71.65, east: -69.8 },
  { lat: -34, west: -72.05, east: -70.1 },
  { lat: -36, west: -72.85, east: -70.5 },
  { lat: -38, west: -73.55, east: -71.0 },
  { lat: -40, west: -73.25, east: -71.5 },
  { lat: -42, west: -74.05, east: -71.7 },
  { lat: -46, west: -75.0, east: -71.7 },
  { lat: -50, west: -75.0, east: -72.2 },
  { lat: -53, west: -74.5, east: -69.0 },
  { lat: -56, west: -72.2, east: -66.8 },
] as const;

function isLikelyInContinentalChile(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat > -17.5 || lat < -56) return false;
  for (let index = 1; index < CHILE_LONGITUDE_CORRIDOR.length; index += 1) {
    const north = CHILE_LONGITUDE_CORRIDOR[index - 1];
    const south = CHILE_LONGITUDE_CORRIDOR[index];
    if (lat <= north.lat && lat >= south.lat) {
      const ratio = (north.lat - lat) / (north.lat - south.lat);
      const west = north.west + (south.west - north.west) * ratio;
      const east = north.east + (south.east - north.east) * ratio;
      return lng >= west && lng <= east;
    }
  }
  return false;
}

// El cap de 1000 filas de PostgREST aplica por respuesta, no al total — se pagina
// con .range() en tandas (ver ADR / hallazgo del dashboard, mismo problema real).
const PAGE_SIZE = 1000;

/** Centrales ya operativas o en construcción con coordenadas — capa separada de `project` (ver ADR-019). */
export async function getPowerPlantsForMap(
  client: SupabaseClient,
  filters: { status?: string; plantType?: string; plantTypes?: string[]; namePatterns?: string[]; search?: string } = {},
): Promise<PowerPlantMapPoint[]> {
  const plantTypes = filters.plantTypes ?? (filters.plantType ? [filters.plantType] : []);
  const namePatterns = filters.namePatterns ?? [];

  const all: PowerPlantMapPoint[] = [];
  let from = 0;
  while (true) {
    let query = client
      .from("power_plant")
      .select("id_central, name, owner_name, technology_detail, plant_type, status, net_capacity_mw, latitude, longitude")
      .eq("is_hidden", false)
      .not("latitude", "is", null);
    if (filters.status) query = query.eq("status", filters.status);
    query = applyPlantTypeAndNameFilter(query, plantTypes, namePatterns);
    if (filters.search && filters.search.trim()) {
      const s = filters.search.trim();
      query = query.or(`name.ilike.%${s}%,owner_name.ilike.%${s}%`);
    }
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Error al leer power_plant: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      if (!isLikelyInContinentalChile(row.latitude, row.longitude)) continue;
      all.push({
        id: row.id_central,
        name: row.name,
        ownerName: row.owner_name,
        technologyDetail: row.technology_detail,
        plantType: row.plant_type,
        status: row.status,
        capacityMw: row.net_capacity_mw,
        lat: row.latitude,
        lng: row.longitude,
      });
    }

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

export interface PowerPlantListItem {
  id: number;
  name: string;
  ownerName: string | null;
  plantType: string | null;
  region: string | null;
  comuna: string | null;
  netCapacityMw: number | null;
  status: string | null;
}

export interface PowerPlantListResult {
  items: PowerPlantListItem[];
  totalCount: number;
  pageSize: number;
}

/**
 * Listado paginado de centrales para tabla.
 * `namePatterns` — heurística por nombre (ILIKE, cualquiera matchea) para tecnologías
 * que el registro de SIPUB no clasifica aparte (BESS/Híbridos quedan mezclados dentro
 * de `plant_type = 'Solares'` u otros — ver ADR-019 y hallazgo de la sección Mercado).
 */
export async function listPowerPlants(
  client: SupabaseClient,
  filters: {
    status?: string;
    statuses?: string[];
    plantType?: string;
    plantTypes?: string[];
    namePatterns?: string[];
    search?: string;
  } = {},
  page = 1,
  pageSize = 30,
): Promise<PowerPlantListResult> {
  const plantTypes = filters.plantTypes ?? (filters.plantType ? [filters.plantType] : []);
  const namePatterns = filters.namePatterns ?? [];

  let query = client
    .from("power_plant")
    .select("id_central, name, owner_name, plant_type, region, comuna, net_capacity_mw, status", { count: "exact" })
    .eq("is_hidden", false);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.statuses && filters.statuses.length > 0) query = query.in("status", filters.statuses);
  query = applyPlantTypeAndNameFilter(query, plantTypes, namePatterns);
  if (filters.search && filters.search.trim()) {
    const s = filters.search.trim();
    query = query.or(`name.ilike.%${s}%,owner_name.ilike.%${s}%`);
  }

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order("net_capacity_mw", { ascending: false, nullsFirst: false })
    .range(from, from + pageSize - 1);

  if (error) throw new Error(`Error al leer power_plant: ${error.message}`);

  return {
    items: (data ?? []).map((r) => ({
      id: r.id_central,
      name: r.name,
      ownerName: r.owner_name,
      plantType: r.plant_type,
      region: r.region,
      comuna: r.comuna,
      netCapacityMw: r.net_capacity_mw,
      status: r.status,
    })),
    totalCount: count ?? 0,
    pageSize,
  };
}
