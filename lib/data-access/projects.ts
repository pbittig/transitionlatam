import type { SupabaseClient } from "@supabase/supabase-js";
import { CHILE_REGION_CENTROIDS } from "@/lib/shared/chileRegionCentroids";
import { contactRoleLabelEs } from "@/lib/shared/contactRoleLabels";
import { PMGD_CAPACITY_THRESHOLD_MW } from "@/lib/shared/projectPhaseDurations";
import type { VerificationSuggestion } from "@/lib/ai/verification/glmSuggestion";

const MAX_PAGE_SIZE = 100;

export type SortDirection = "asc" | "desc";

export interface ProjectFilters {
  technologyCode?: string;
  /** Multi-select — cualquiera de estos códigos matchea (usado por los chips de tecnología). */
  technologyCodes?: string[];
  regionId?: string;
  status?: string;
  countryCode?: string;
  /**
   * "overdue" — fecha estimada de conexión ya pasó y la solicitud no fue
   * rechazada/desistida (proyectos que "ya deberían haber entrado en operación").
   * "upcoming" — desde el día 1 del mes en curso hacia adelante (pipeline futuro).
   * "historico_completo" — todo lo que ya pasó de fecha (vencido, activo o no) MÁS
   * todo lo rechazado/desistido sin importar la fecha — usado en las secciones de
   * Mercado (BESS/Solar/Eólico/etc.), distinto de "overdue" que excluye rechazados.
   */
  connectionPeriod?: "overdue" | "upcoming" | "historico_completo";
  /**
   * Filtra por nombre de proyecto (ILIKE, cualquiera de los patrones matchea) —
   * usado para secciones sin tecnología propia en el esquema, ej. Data Center
   * (heurística por nombre, no un dato estructurado — ver ADR correspondiente).
   */
  namePatterns?: string[];
  /** Buscador de texto libre — filtra por nombre de proyecto (ILIKE), se combina con AND sobre el resto de filtros. */
  search?: string;
  /** Restringe a estos IDs exactos — usado por filtros calculados en Node (ej. etapa estimada) que no se pueden expresar como columna de la tabla project. */
  projectIds?: string[];
  /** Rango adicional de fecha estimada de conexión (barra deslizante) — se combina con AND sobre connectionPeriod. */
  connectionDateFrom?: string;
  connectionDateTo?: string;
  /**
   * Orden estilo Excel para el listado de admin (Editar data) — solo aplica cuando no
   * hay connectionPeriod (ese caso ya trae su propio orden). No incluye ordenar por
   * empresa: Postgrest ignora `.order(col, { foreignTable })` sobre este embed en esta
   * instancia (probado contra la base real, sin error pero sin efecto), así que solo se
   * exponen columnas propias de `project`.
   */
  sortBy?: "name" | "capacityMw";
  sortDir?: SortDirection;
  /** Solo proyectos con verified_at — usado en /proyectos-esperados para no exponer fichas sin revisar mientras se sigue verificando la cartera. */
  verifiedOnly?: boolean;
}

export const REJECTED_STATUSES = ["Rechazada", "Desistida"];

export function startOfCurrentMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface ProjectListItem {
  id: string;
  name: string;
  internalCode: string;
  technology: string | null;
  technologyCode: string | null;
  includesStorage: boolean;
  projectKind: string | null;
  region: string | null;
  comuna: string | null;
  capacityMw: number | null;
  capacityMwh: number | null;
  netInjectionMw: number | null;
  netWithdrawalMw: number | null;
  generationCapacityMw: number | null;
  storageCapacityMw: number | null;
  storageHours: number | null;
  status: string | null;
  estimatedConnectionDate: string | null;
  developerCompany: string | null;
  developerCompanyId: string | null;
  spv: string | null;
}

export interface ProjectListResult {
  items: ProjectListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}

/**
 * Resuelve códigos de tecnología a sus UUID — se filtra el proyecto por la
 * columna directa `technology_id`, no por el recurso embebido `technology.code`.
 * Dos razones reales: (1) PostgREST solo restringe filas del padre con un filtro
 * sobre un embed si es inner join (!inner) — con left join el filtro no excluye
 * nada (bug real encontrado: .eq("technology.code", "bess") devolvía las 2758
 * filas de `project`); (2) esta instancia de PostgREST directamente no puede
 * parsear un `or()` que referencie una columna embebida en absoluto, ni con
 * !inner (error real: "failed to parse logic tree" incluso con un solo
 * `technology.code.eq.X` dentro de or()) — así que combinar tecnología con
 * patrones de nombre por OR exige que ambos lados sean columnas planas de `project`.
 */
async function resolveTechnologyIds(client: SupabaseClient, codes: string[]): Promise<string[]> {
  if (codes.length === 0) return [];
  const { data, error } = await client.from("technology").select("id").in("code", codes);
  if (error) throw new Error(`Error resolviendo tecnologías: ${error.message}`);
  return (data ?? []).map((t) => t.id as string);
}

/** Server-side paginated project listing — the map/list views should call this, never query Supabase directly. */
export async function listProjects(
  client: SupabaseClient,
  filters: ProjectFilters,
  page = 1,
  pageSize = 25,
): Promise<ProjectListResult> {
  const size = Math.min(pageSize, MAX_PAGE_SIZE);
  const from = (page - 1) * size;
  const to = from + size - 1;

  const technologyCodes = filters.technologyCodes ?? (filters.technologyCode ? [filters.technologyCode] : []);
  const namePatterns = filters.namePatterns ?? [];
  const technologyIds = await resolveTechnologyIds(client, technologyCodes);
  const hasTechFilter = technologyIds.length > 0;
  const hasNameFilter = namePatterns.length > 0;

  const locationEmbed = filters.regionId
    ? "location:location_id!inner(comuna, region:region_id(name))"
    : "location:location_id(comuna, region:region_id(name))";
  const countryEmbed = filters.countryCode ? "country:country_id!inner(code)" : "country:country_id(code)";

  let query = client
    .from("project")
    .select(
      `id, name, internal_code, developer_company_id, capacity_mw, capacity_mwh, net_injection_mw, net_withdrawal_mw, generation_capacity_mw, storage_capacity_mw, storage_hours, includes_storage, project_kind, status, estimated_connection_date, technology:technology_id(name, code), ${locationEmbed}, ${countryEmbed}, developer:developer_company_id(name), spv:spv_id(name)`,
      { count: "exact" },
    )
    .range(from, to);

  if (filters.countryCode) query = query.eq("country.code", filters.countryCode);
  if (filters.regionId) query = query.eq("location.region_id", filters.regionId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.search && filters.search.trim()) query = query.ilike("name", `%${filters.search.trim()}%`);
  if (filters.projectIds) query = query.in("id", filters.projectIds);
  if (filters.verifiedOnly) query = query.not("verified_at", "is", null);

  // Tecnología (chips multi-select) y patrones de nombre (Data Center) se combinan
  // con OR cuando ambos están activos — cualquiera de los dos matchea. Si solo se
  // pidió tecnología pero ningún código resolvió a un id real, no debe devolver
  // todo sin filtrar — se fuerza a vacío con un id imposible.
  if (hasTechFilter && hasNameFilter) {
    query = query.or([`technology_id.in.(${technologyIds.join(",")})`, ...namePatterns.map((p) => `name.ilike.%${p}%`)].join(","));
  } else if (hasTechFilter) {
    query = technologyIds.length === 1 ? query.eq("technology_id", technologyIds[0]) : query.in("technology_id", technologyIds);
  } else if (hasNameFilter) {
    query = query.or(namePatterns.map((p) => `name.ilike.%${p}%`).join(","));
  } else if (technologyCodes.length > 0) {
    query = query.eq("technology_id", "00000000-0000-0000-0000-000000000000");
  }

  if (filters.connectionPeriod === "overdue") {
    query = query
      .lt("estimated_connection_date", todayIso())
      .not("estimated_connection_date", "is", null)
      .not("status", "in", `(${REJECTED_STATUSES.join(",")})`)
      .order("estimated_connection_date", { ascending: true });
  } else if (filters.connectionPeriod === "upcoming") {
    // Rechazada/Desistida se excluyen aunque su fecha estimada quede en el futuro —
    // ya no son parte del pipeline vigente, van a Histórico (hallazgo real: se
    // colaban acá porque solo se filtraba por fecha, no por estado).
    query = query
      .gte("estimated_connection_date", startOfCurrentMonthIso())
      .not("status", "in", `(${REJECTED_STATUSES.join(",")})`)
      .order("estimated_connection_date", { ascending: true });
  } else if (filters.connectionPeriod === "historico_completo") {
    query = query
      .or(
        `and(estimated_connection_date.lt.${todayIso()},estimated_connection_date.not.is.null),status.in.(${REJECTED_STATUSES.join(",")})`,
      )
      .order("estimated_connection_date", { ascending: false });
  } else if (filters.sortBy) {
    const ascending = (filters.sortDir ?? "asc") === "asc";
    query = filters.sortBy === "capacityMw" ? query.order("capacity_mw", { ascending, nullsFirst: false }) : query.order("name", { ascending });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  if (filters.connectionDateFrom) query = query.gte("estimated_connection_date", filters.connectionDateFrom);
  if (filters.connectionDateTo) query = query.lte("estimated_connection_date", filters.connectionDateTo);

  const { data, error, count } = await query;
  if (error) throw new Error(`Error listando proyectos: ${error.message}`);

  const items: ProjectListItem[] = (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      name: string;
      internal_code: string;
      developer_company_id: string | null;
      capacity_mw: number | null;
      capacity_mwh: number | null;
      net_injection_mw: number | null;
      net_withdrawal_mw: number | null;
      generation_capacity_mw: number | null;
      storage_capacity_mw: number | null;
      storage_hours: number | null;
      includes_storage: boolean;
      project_kind: string | null;
      status: string | null;
      estimated_connection_date: string | null;
      technology: { name: string; code: string } | null;
      location: { comuna: string | null; region: { name: string } | null } | null;
      developer: { name: string } | null;
      spv: { name: string } | null;
    };
    return {
      id: r.id,
      name: r.name,
      internalCode: r.internal_code,
      technology: r.technology?.name ?? null,
      technologyCode: r.technology?.code ?? null,
      includesStorage: r.includes_storage,
      projectKind: r.project_kind,
      region: r.location?.region?.name ?? null,
      comuna: r.location?.comuna ?? null,
      capacityMw: r.capacity_mw,
      capacityMwh: r.capacity_mwh,
      netInjectionMw: r.net_injection_mw,
      netWithdrawalMw: r.net_withdrawal_mw,
      generationCapacityMw: r.generation_capacity_mw,
      storageCapacityMw: r.storage_capacity_mw,
      storageHours: r.storage_hours,
      status: r.status,
      estimatedConnectionDate: r.estimated_connection_date,
      developerCompany: r.developer?.name ?? null,
      developerCompanyId: r.developer_company_id,
      spv: r.spv?.name ?? null,
    };
  });

  return { items, page, pageSize: size, totalCount: count ?? 0 };
}

export interface DashboardStats {
  totalProjects: number;
  totalCapacityMw: number;
  totalCapacityMwh: number;
  byTechnology: Array<{ technology: string; count: number; capacityMw: number }>;
  byRegion: Array<{ region: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  byConnectionYear: Array<{ year: number; count: number; capacityMw: number }>;
}

/**
 * Aggregates for the public dashboard — computed server-side via `get_dashboard_stats()`
 * (see migration 20260721000000). PostgREST caps unpaginated row-level queries at
 * 1000 rows by default; fetching all projects into Node to sum them would silently
 * undercount past that point, so the aggregation lives in SQL instead.
 */
export async function getDashboardStats(client: SupabaseClient): Promise<DashboardStats> {
  const { data, error } = await client.rpc("get_dashboard_stats");
  if (error) throw new Error(`Error calculando estadísticas del dashboard: ${error.message}`);
  return data as DashboardStats;
}

export interface ProjectDetail extends ProjectListItem {
  externalReference: string | null;
  // NUP: identificador único de proyecto del Coordinador — viene en el listado
  // de Acceso Abierto para ~85% de las solicitudes (2.350/2.758 verificado).
  nup: string | null;
  connectionPoint: string | null;
  voltageLevel: string | null;
  requestType: string | null;
  countryCode: string | null;
  developerCompanyId: string | null;
  technologyCode: string | null;
  // RUT y dirección legal son datos de la EMPRESA (registro público), no de
  // personas — no llevan la misma restricción de acceso que los contactos.
  developerCompanyRut: string | null;
  developerCompanyAddress: string | null;
  verifiedAt: string | null;
  editorialStatus: "pending" | "published" | "excluded";
  aiScreenedAt: string | null;
  aiDataSanity: "ok" | "sospechoso" | null;
  aiDataSanityReason: string | null;
  aiSeiaPick: string | null;
  aiSeiaPickReason: string | null;
  /** 'generation' | 'storage' | 'consumption' | 'transmission' | 'hybrid' | null — 'storage' es BESS puro, sin componente de generación. */
  projectKind: string | null;
}

export async function getProjectById(client: SupabaseClient, id: string): Promise<ProjectDetail | null> {
  const { data, error } = await client
    .from("project")
    .select(
      "id, name, internal_code, external_reference, nup, capacity_mw, capacity_mwh, net_injection_mw, net_withdrawal_mw, generation_capacity_mw, storage_capacity_mw, storage_hours, includes_storage, status, estimated_connection_date, verified_at, editorial_status, ai_screened_at, ai_data_sanity, ai_data_sanity_reason, ai_seia_pick, ai_seia_pick_reason, project_kind, developer_company_id, technology:technology_id(name, code), location:location_id(comuna, region:region_id(name)), country:country_id(code), developer:developer_company_id(name, rut, legal_address), spv:spv_id(name), project_connection(connection_point, voltage_level, request_type)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Error obteniendo proyecto: ${error.message}`);
  if (!data) return null;

  const r = data as unknown as {
    id: string;
    name: string;
    internal_code: string;
    external_reference: string | null;
    nup: string | null;
    capacity_mw: number | null;
    capacity_mwh: number | null;
    net_injection_mw: number | null;
    net_withdrawal_mw: number | null;
    generation_capacity_mw: number | null;
    storage_capacity_mw: number | null;
    storage_hours: number | null;
    includes_storage: boolean;
    status: string | null;
    estimated_connection_date: string | null;
    verified_at: string | null;
    editorial_status: "pending" | "published" | "excluded";
    ai_screened_at: string | null;
    ai_data_sanity: string | null;
    ai_data_sanity_reason: string | null;
    ai_seia_pick: string | null;
    ai_seia_pick_reason: string | null;
    project_kind: string | null;
    developer_company_id: string | null;
    technology: { name: string; code: string } | null;
    location: { comuna: string | null; region: { name: string } | null } | null;
    country: { code: string } | null;
    developer: { name: string; rut: string | null; legal_address: string | null } | null;
    spv: { name: string } | null;
    project_connection: Array<{ connection_point: string | null; voltage_level: string | null; request_type: string | null }>;
  };
  const connection = r.project_connection?.[0];

  return {
    id: r.id,
    name: r.name,
    internalCode: r.internal_code,
    externalReference: r.external_reference,
    nup: r.nup,
    developerCompanyId: r.developer_company_id,
    technology: r.technology?.name ?? null,
    technologyCode: r.technology?.code ?? null,
    includesStorage: r.includes_storage,
    region: r.location?.region?.name ?? null,
    comuna: r.location?.comuna ?? null,
    capacityMw: r.capacity_mw,
    capacityMwh: r.capacity_mwh,
    netInjectionMw: r.net_injection_mw,
    netWithdrawalMw: r.net_withdrawal_mw,
    generationCapacityMw: r.generation_capacity_mw,
    storageCapacityMw: r.storage_capacity_mw,
    storageHours: r.storage_hours,
    status: r.status,
    estimatedConnectionDate: r.estimated_connection_date,
    verifiedAt: r.verified_at,
    editorialStatus: r.editorial_status,
    aiScreenedAt: r.ai_screened_at,
    aiDataSanity: r.ai_data_sanity as "ok" | "sospechoso" | null,
    aiDataSanityReason: r.ai_data_sanity_reason,
    aiSeiaPick: r.ai_seia_pick,
    aiSeiaPickReason: r.ai_seia_pick_reason,
    projectKind: r.project_kind,
    developerCompany: r.developer?.name ?? null,
    developerCompanyRut: r.developer?.rut ?? null,
    developerCompanyAddress: r.developer?.legal_address ?? null,
    spv: r.spv?.name ?? null,
    connectionPoint: connection?.connection_point ?? null,
    voltageLevel: connection?.voltage_level ?? null,
    requestType: connection?.request_type ?? null,
    countryCode: r.country?.code ?? null,
  };
}

export interface VerificationQueueItem {
  id: string;
  name: string;
  internalCode: string;
  comuna: string | null;
  region: string | null;
  capacityMw: number | null;
  estimatedConnectionDate: string | null;
  status: string | null;
  aiScreenedAt: string | null;
  aiDataSanity: "ok" | "sospechoso" | null;
  aiSeiaPick: string | null;
}

export type VerificationSortColumn = "name" | "capacityMw" | "estimatedConnectionDate" | "status";

export interface VerificationSort {
  column: VerificationSortColumn;
  direction: SortDirection;
}

const VERIFICATION_SORT_COLUMNS: Record<VerificationSortColumn, string> = {
  name: "name",
  capacityMw: "capacity_mw",
  estimatedConnectionDate: "estimated_connection_date",
  status: "status",
};

const VERIFICATION_QUEUE_SELECT =
  "id, name, internal_code, capacity_mw, estimated_connection_date, status, ai_screened_at, ai_data_sanity, ai_seia_pick, location:location_id(comuna, region:region_id(name))";

type VerificationQueueRow = {
  id: string;
  name: string;
  internal_code: string;
  capacity_mw: number | null;
  estimated_connection_date: string | null;
  status: string | null;
  ai_screened_at: string | null;
  ai_data_sanity: string | null;
  ai_seia_pick: string | null;
  location: { comuna: string | null; region: { name: string } | null } | null;
};

function mapVerificationQueueRow(row: VerificationQueueRow): VerificationQueueItem {
  return {
    id: row.id,
    name: row.name,
    internalCode: row.internal_code,
    comuna: row.location?.comuna ?? null,
    region: row.location?.region?.name ?? null,
    capacityMw: row.capacity_mw,
    estimatedConnectionDate: row.estimated_connection_date,
    status: row.status,
    aiScreenedAt: row.ai_screened_at,
    aiDataSanity: row.ai_data_sanity as "ok" | "sospechoso" | null,
    aiSeiaPick: row.ai_seia_pick,
  };
}

export type VerificationPeriod = "vigente" | "historico";

/**
 * Mismo criterio "vigente vs histórico" que ya usa /proyectos-esperados (ver
 * connectionPeriod "upcoming"/"historico_completo" en listProjects): vigente = no
 * rechazado/desistido y fecha de conexión desde el inicio de mes; histórico = todo lo
 * demás (rechazado, desistido, vencido, o sin fecha). Aplicado como filtro AND sobre lo
 * que ya traiga `query` — no reemplaza otros filtros.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- el query builder de supabase-js encadena por mutación de tipo, sin un Database tipado no vale la pena reconstruir su firma acá (mismo criterio pragmático que el resto de este archivo con updates dinámicos).
function applyPeriodFilter<T extends { not: (...args: any[]) => T; gte: (...args: any[]) => T; or: (...args: any[]) => T }>(
  query: T,
  period: VerificationPeriod,
): T {
  const startOfMonth = startOfCurrentMonthIso();
  if (period === "vigente") {
    return query.not("status", "in", `(${REJECTED_STATUSES.join(",")})`).gte("estimated_connection_date", startOfMonth);
  }
  return query.or(
    `status.in.(${REJECTED_STATUSES.join(",")}),estimated_connection_date.lt.${startOfMonth},estimated_connection_date.is.null`,
  );
}

/**
 * Cola del Verificador: proyectos con verified_at null. Sin `period` ni `sort`, usa el
 * criterio histórico "esperados primero" que scripts/sync-formulario-bulk.ts — vigentes
 * antes que el resto, en una sola lista mezclada. Con `period` ("vigente" | "historico",
 * pedido desde la UI para separar en dos colas navegables — vigente se verifica hoy,
 * histórico se deja para después con más gente), se filtra a solo esa categoría. Con
 * `sort` (orden estilo Excel), se ordena por la columna elegida en vez del orden por
 * defecto de cada modo.
 */
export async function getVerificationQueue(
  client: SupabaseClient,
  limit = 500,
  sort?: VerificationSort,
  period?: VerificationPeriod,
): Promise<VerificationQueueItem[]> {
  if (sort || period) {
    let query = client
      .from("project")
      .select(VERIFICATION_QUEUE_SELECT)
      .or("prefilter_status.neq.out_of_scope,prefilter_status.is.null")
      .is("verified_at", null);
    if (period) query = applyPeriodFilter(query, period);

    if (sort) {
      query = query.order(VERIFICATION_SORT_COLUMNS[sort.column], { ascending: sort.direction === "asc", nullsFirst: false });
    } else if (period === "vigente") {
      query = query.order("estimated_connection_date", { ascending: true });
    } else {
      query = query.order("created_at", { ascending: true });
    }

    const { data, error } = await query.limit(limit);
    if (error) throw new Error(`Error obteniendo cola de verificación: ${error.message}`);
    return ((data ?? []) as unknown as VerificationQueueRow[]).map(mapVerificationQueueRow);
  }

  const startOfMonth = startOfCurrentMonthIso();

  const [{ data: esperados, error: e1 }, { data: resto, error: e2 }] = await Promise.all([
    client
      .from("project")
      .select(VERIFICATION_QUEUE_SELECT)
      .or("prefilter_status.neq.out_of_scope,prefilter_status.is.null")
      .is("verified_at", null)
      .not("status", "in", `(${REJECTED_STATUSES.join(",")})`)
      .gte("estimated_connection_date", startOfMonth)
      .order("estimated_connection_date", { ascending: true })
      .limit(limit),
    client
      .from("project")
      .select(VERIFICATION_QUEUE_SELECT)
      .or("prefilter_status.neq.out_of_scope,prefilter_status.is.null")
      .is("verified_at", null)
      .or(
        `status.in.(${REJECTED_STATUSES.join(",")}),estimated_connection_date.lt.${startOfMonth},estimated_connection_date.is.null`,
      )
      .order("created_at", { ascending: true })
      .limit(limit),
  ]);
  if (e1) throw new Error(`Error obteniendo cola de verificación: ${e1.message}`);
  if (e2) throw new Error(`Error obteniendo cola de verificación: ${e2.message}`);

  const seen = new Set<string>();
  const merged = [
    ...((esperados ?? []) as unknown as VerificationQueueRow[]),
    ...((resto ?? []) as unknown as VerificationQueueRow[]),
  ].filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });

  return merged.slice(0, limit).map(mapVerificationQueueRow);
}

/** Conteo total de proyectos sin verificar — para la tarjeta de /admin. */
export async function countUnverifiedProjects(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from("project")
    .select("id", { count: "exact", head: true })
    .or("prefilter_status.neq.out_of_scope,prefilter_status.is.null")
    .is("verified_at", null);
  if (error) throw new Error(`Error contando proyectos sin verificar: ${error.message}`);
  return count ?? 0;
}

/**
 * Persiste el resultado de una sugerencia de IA — llamado tanto por el botón on-demand
 * del Verificador (getAiVerificationSuggestion) como por scripts/screen-verification-queue.ts,
 * así ambos caminos alimentan la misma caché sin duplicar el punto de escritura.
 */
export async function saveAiScreeningResult(
  client: SupabaseClient,
  projectId: string,
  suggestion: VerificationSuggestion,
): Promise<void> {
  const normalizedSanity: "ok" | "sospechoso" =
    suggestion.dataSanity?.trim().toLowerCase() === "sospechoso" ? "sospechoso" : "ok";
  const trimmedPick = suggestion.seiaPick?.trim();
  const normalizedPick = trimmedPick && trimmedPick.toLowerCase() !== "null" ? trimmedPick : null;

  const { error } = await client
    .from("project")
    .update({
      ai_screened_at: new Date().toISOString(),
      ai_data_sanity: normalizedSanity,
      ai_data_sanity_reason: suggestion.dataSanityReason,
      ai_seia_pick: normalizedPick,
      ai_seia_pick_reason: suggestion.seiaPickReason,
    })
    .eq("id", projectId);
  if (error) throw new Error(`Error guardando tamizado de IA: ${error.message}`);
}

/**
 * Subconjunto de la cola marcado como dudoso por el tamizado de IA: sanity sospechoso, o
 * un candidato SEIA sugerido (confirmado con el usuario: vale la pena revisar aunque los
 * datos estén bien). Proyectos sin tamizar (ai_screened_at null) no aparecen acá.
 */
export async function getDoubtfulProjects(
  client: SupabaseClient,
  limit = 100,
  sort?: VerificationSort,
  period?: VerificationPeriod,
): Promise<VerificationQueueItem[]> {
  let query = client
    .from("project")
    .select(VERIFICATION_QUEUE_SELECT)
    .or("prefilter_status.neq.out_of_scope,prefilter_status.is.null")
    .is("verified_at", null)
    .or("ai_data_sanity.eq.sospechoso,ai_seia_pick.not.is.null");
  if (period) query = applyPeriodFilter(query, period);

  query = sort
    ? query.order(VERIFICATION_SORT_COLUMNS[sort.column], { ascending: sort.direction === "asc", nullsFirst: false })
    : query.order("ai_screened_at", { ascending: false });

  const { data, error } = await query.limit(limit);
  if (error) throw new Error(`Error obteniendo proyectos dudosos: ${error.message}`);

  return ((data ?? []) as unknown as VerificationQueueRow[]).map(mapVerificationQueueRow);
}

export interface VerificationScreeningStats {
  totalPending: number;
  screened: number;
  doubtful: number;
}

/**
 * Estadísticas de avance del tamizado de IA — para el contador de /admin/verificador.
 * `screened` cuenta el total tamizado alguna vez (sin importar si después se verificó) —
 * verificar un proyecto no deshace el trabajo de tamizado ya invertido en él. `totalPending`
 * y `doubtful` sí se acotan a lo que queda pendiente: son "cuánto trabajo falta", no un
 * historial.
 */
export async function getVerificationScreeningStats(client: SupabaseClient): Promise<VerificationScreeningStats> {
  const [{ count: totalPending, error: e1 }, { count: screened, error: e2 }, { count: doubtful, error: e3 }] =
    await Promise.all([
      client.from("project").select("id", { count: "exact", head: true }).or("prefilter_status.neq.out_of_scope,prefilter_status.is.null").is("verified_at", null),
      client.from("project").select("id", { count: "exact", head: true }).or("prefilter_status.neq.out_of_scope,prefilter_status.is.null").not("ai_screened_at", "is", null),
      client
        .from("project")
        .select("id", { count: "exact", head: true })
        .or("prefilter_status.neq.out_of_scope,prefilter_status.is.null")
        .is("verified_at", null)
        .or("ai_data_sanity.eq.sospechoso,ai_seia_pick.not.is.null"),
    ]);
  if (e1) throw new Error(`Error contando estadísticas de tamizado: ${e1.message}`);
  if (e2) throw new Error(`Error contando estadísticas de tamizado: ${e2.message}`);
  if (e3) throw new Error(`Error contando estadísticas de tamizado: ${e3.message}`);
  return { totalPending: totalPending ?? 0, screened: screened ?? 0, doubtful: doubtful ?? 0 };
}

export interface VerificationPeriodStats {
  vigentePending: number;
  historicoPending: number;
}

/** Cuántos quedan pendientes en cada cola — vigente (verificar hoy) vs histórico (después, con más gente). */
export async function getVerificationPeriodStats(client: SupabaseClient): Promise<VerificationPeriodStats> {
  const [{ count: vigentePending, error: e1 }, { count: historicoPending, error: e2 }] = await Promise.all([
    applyPeriodFilter(client.from("project").select("id", { count: "exact", head: true }).or("prefilter_status.neq.out_of_scope,prefilter_status.is.null").is("verified_at", null), "vigente"),
    applyPeriodFilter(client.from("project").select("id", { count: "exact", head: true }).or("prefilter_status.neq.out_of_scope,prefilter_status.is.null").is("verified_at", null), "historico"),
  ]);
  if (e1) throw new Error(`Error contando cola vigente: ${e1.message}`);
  if (e2) throw new Error(`Error contando cola histórica: ${e2.message}`);
  return { vigentePending: vigentePending ?? 0, historicoPending: historicoPending ?? 0 };
}

export interface VerificationProgress {
  verified: number;
  total: number;
}

/** Verificados vs. total del pipeline vigente — para la barra de progreso pública en /proyectos-esperados (que solo lista verificados mientras se sigue revisando el resto). */
export interface AdminVerificationProgress extends VerificationProgress {
  verifiedToday: number;
}

/** Avance global y producción del día para la gestión interna del verificador. */
export async function getAdminVerificationProgress(client: SupabaseClient): Promise<AdminVerificationProgress> {
  const todayInChile = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const startOfDay = `${todayInChile}T00:00:00-04:00`;
  const endOfDay = `${todayInChile}T23:59:59.999-04:00`;

  const [{ count: verified, error: e1 }, { count: total, error: e2 }, { count: verifiedToday, error: e3 }] =
    await Promise.all([
      applyPeriodFilter(
        client.from("project").select("id", { count: "exact", head: true }).or("prefilter_status.neq.out_of_scope,prefilter_status.is.null"),
        "vigente",
      ).not("verified_at", "is", null),
      applyPeriodFilter(
        client.from("project").select("id", { count: "exact", head: true }).or("prefilter_status.neq.out_of_scope,prefilter_status.is.null"),
        "vigente",
      ),
      applyPeriodFilter(
        client.from("project").select("id", { count: "exact", head: true }).or("prefilter_status.neq.out_of_scope,prefilter_status.is.null"),
        "vigente",
      )
        .gte("verified_at", startOfDay)
        .lte("verified_at", endOfDay),
    ]);
  if (e1) throw new Error(`Error contando proyectos verificados: ${e1.message}`);
  if (e2) throw new Error(`Error contando proyectos totales: ${e2.message}`);
  if (e3) throw new Error(`Error contando verificaciones de hoy: ${e3.message}`);
  return { verified: verified ?? 0, total: total ?? 0, verifiedToday: verifiedToday ?? 0 };
}

export async function getVigenteVerificationProgress(client: SupabaseClient): Promise<VerificationProgress> {
  // Mismo shape de query en ambas llamadas a applyPeriodFilter (el filtro de
  // verified_at se encadena DESPUÉS) — pasarle chains con formas distintas dispara
  // "Type instantiation is excessively deep" en el genérico T (hallazgo real).
  const [{ count: verified, error: e1 }, { count: total, error: e2 }] = await Promise.all([
    applyPeriodFilter(client.from("project").select("id", { count: "exact", head: true }), "vigente").not("verified_at", "is", null),
    applyPeriodFilter(client.from("project").select("id", { count: "exact", head: true }), "vigente"),
  ]);
  if (e1) throw new Error(`Error contando verificados vigentes: ${e1.message}`);
  if (e2) throw new Error(`Error contando total vigente: ${e2.message}`);
  return { verified: verified ?? 0, total: total ?? 0 };
}

export interface ProjectTimelineEntry {
  id: string;
  eventType: string;
  occurredAt: string;
  description: string | null;
  confidenceLevel: string;
}

export async function getProjectTimeline(client: SupabaseClient, projectId: string): Promise<ProjectTimelineEntry[]> {
  const { data, error } = await client
    .from("project_event")
    .select("id, event_type, occurred_at, description, confidence_level")
    .eq("project_id", projectId)
    .order("occurred_at", { ascending: false });
  if (error) throw new Error(`Error obteniendo historial del proyecto: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    eventType: row.event_type as string,
    occurredAt: row.occurred_at as string,
    description: row.description as string | null,
    confidenceLevel: row.confidence_level as string,
  }));
}

export interface RecentEvent {
  id: string;
  projectId: string;
  projectName: string;
  eventType: string;
  occurredAt: string;
  description: string | null;
}

/** Últimos eventos del sistema completo (todos los proyectos) — para el resumen "Inteligencia reciente" del home. */
export async function getRecentProjectEvents(client: SupabaseClient, limit = 6): Promise<RecentEvent[]> {
  const { data, error } = await client
    .from("project_event")
    .select("id, project_id, event_type, occurred_at, description, project:project_id(name)")
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Error obteniendo eventos recientes: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    projectId: row.project_id as string,
    projectName: (row.project as unknown as { name: string } | null)?.name ?? "Proyecto",
    eventType: row.event_type as string,
    occurredAt: row.occurred_at as string,
    description: row.description as string | null,
  }));
}

/** Proyectos que entraron a Acceso Abierto (evento "announced") en las últimas `sinceHours` horas. */
export async function getRecentlyAnnouncedProjects(client: SupabaseClient, sinceHours = 24): Promise<RecentEvent[]> {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
  const { data, error } = await client
    .from("project_event")
    .select("id, project_id, event_type, occurred_at, description, project:project_id(name)")
    .eq("event_type", "announced")
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false });
  if (error) throw new Error(`Error obteniendo proyectos nuevos: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    projectId: row.project_id as string,
    projectName: (row.project as unknown as { name: string } | null)?.name ?? "Proyecto",
    eventType: row.event_type as string,
    occurredAt: row.occurred_at as string,
    description: row.description as string | null,
  }));
}

export interface ProjectStakeholder {
  personId: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
}

export interface CompanyProjectSummary {
  id: string;
  name: string;
  technology: string | null;
  capacityMw: number | null;
  estimatedConnectionDate: string | null;
  status: string | null;
}

/** Proyectos asociados a una empresa para la vista de relación comercial. */
export async function getCompanyProjects(
  client: SupabaseClient,
  companyId: string | null,
  limit = 8,
): Promise<CompanyProjectSummary[]> {
  if (!companyId) return [];

  const { data, error } = await client
    .from("project")
    .select("id, name, capacity_mw, estimated_connection_date, status, technology:technology_id(name)")
    .eq("developer_company_id", companyId)
    .order("estimated_connection_date", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`Error obteniendo proyectos de empresa: ${error.message}`);

  return ((data ?? []) as unknown as Array<{
    id: string;
    name: string;
    capacity_mw: number | null;
    estimated_connection_date: string | null;
    status: string | null;
    technology: { name: string } | null;
  }>).map((project) => ({
    id: project.id,
    name: project.name,
    technology: project.technology?.name ?? null,
    capacityMw: project.capacity_mw,
    estimatedConnectionDate: project.estimated_connection_date,
    status: project.status,
  }));
}

/** Junta personas + roles a partir de filas person->target de entity_relationship ya resueltas — compartido entre el camino por proyecto y el de respaldo por empresa de getProjectStakeholders. */
async function resolveStakeholders(
  client: SupabaseClient,
  relRows: Array<{ relationship_type: string; source_id: string }>,
): Promise<ProjectStakeholder[]> {
  if (!relRows.length) return [];

  const { data: people } = await client
    .from("person")
    .select("id, full_name, email, phone")
    .in("id", relRows.map((r) => r.source_id));

  const peopleById = new Map((people ?? []).map((p) => [p.id as string, p]));

  // Una misma persona puede tener varios roles hacia el mismo proyecto/empresa (ej.
  // "firmante" y "coordinador de proyecto" del Formulario) — se agrupan en
  // una sola tarjeta para no repetir a la persona ni duplicar la key de React.
  // Los roles se deduplican ignorando mayúsculas/espacios: distintos documentos
  // del mismo proyecto a veces re-extraen el mismo cargo con grafía distinta
  // (ej. "Ingeniero Senior de Estudios y Conexiones" vs "Ingeniero senior de
  // Estudios y Conexiones"), y sin esto se acumulan como si fueran roles
  // distintos.
  const rolesByPerson = new Map<string, Map<string, string>>();
  for (const r of relRows) {
    if (!peopleById.has(r.source_id)) continue;
    const role = contactRoleLabelEs(r.relationship_type);
    const dedupeKey = role.trim().toLowerCase().replace(/\s+/g, " ");
    const roles = rolesByPerson.get(r.source_id) ?? new Map<string, string>();
    if (!roles.has(dedupeKey)) roles.set(dedupeKey, role.trim());
    rolesByPerson.set(r.source_id, roles);
  }

  return [...rolesByPerson.entries()].map(([personId, roles]) => {
    const p = peopleById.get(personId)!;
    return {
      personId,
      name: p.full_name as string,
      role: [...roles.values()].join(", "),
      email: p.email as string | null,
      phone: p.phone as string | null,
    };
  });
}

/**
 * Contactos de ESTE proyecto específico — nunca relacionados por RUT/nombre de la
 * empresa desarrolladora (decisión confirmada con el usuario: dos proyectos de la
 * misma empresa no deben compartir contactos solo porque comparten dueño; hallazgo
 * real: "Circinus SpA" tiene 12 proyectos y, con el criterio viejo por empresa, los 12
 * mostraban exactamente los mismos 4 contactos sin importar de cuál Formulario
 * vinieron realmente).
 */
export async function getProjectStakeholders(
  client: SupabaseClient,
  projectId: string,
  developerCompanyId: string | null,
  // El editor de admin (ProjectContactsEditor) necesita mostrar EXACTAMENTE lo que
  // tiene vinculado este proyecto, nunca el respaldo por empresa — si un admin borra
  // el último contacto a propósito, la lista debe quedar vacía, no repoblarse con
  // contactos de otros proyectos de la misma empresa (hallazgo real: se veía como
  // "guardé estos contactos y aparecen otros distintos"). La ficha pública sí sigue
  // usando el respaldo, para no dejar sin contactos a lo que el Formulario aún no
  // reprocesó con el vínculo por proyecto.
  options: { skipCompanyFallback?: boolean } = {},
): Promise<ProjectStakeholder[]> {
  const { data: projectRows, error: projectRelError } = await client
    .from("entity_relationship")
    .select("relationship_type, source_id")
    .eq("source_type", "person")
    .eq("target_type", "project")
    .eq("target_id", projectId);
  if (projectRelError) throw new Error(`Error obteniendo stakeholders: ${projectRelError.message}`);
  if (projectRows?.length || options.skipCompanyFallback) {
    return resolveStakeholders(
      client,
      projectRows.map((r) => ({ relationship_type: r.relationship_type as string, source_id: r.source_id as string })),
    );
  }

  // Respaldo para proyectos que el Formulario todavía no reprocesó con el vínculo por
  // proyecto (ver lib/ingestion/sources/energia-abierta/detalle-formulario/load.ts) —
  // mismo criterio histórico por empresa, para no dejar sin contactos de un día para
  // otro a lo que aún no se reprocesó. El company_id "oficial" del proyecto
  // (project.developer_company_id, poblada por la ingesta de SIPUB/listado, que solo
  // matchea empresas por nombre exacto) y el que el Formulario vincula por separado
  // (RUT primero) no siempre son la misma fila de `company` — dos ingestas
  // independientes, cada una con su propio getOrCreateCompany, y basta que la razón
  // social se escriba distinto en cada fuente para que terminen en dos empresas
  // separadas. Hallazgo real: "Eléctrica Santa Teresa SpA" / proyecto "Ampliación Mega
  // Data Center Lampa". Se juntan acá ambos orígenes.
  const { data: developedByRows } = await client
    .from("entity_relationship")
    .select("target_id")
    .eq("source_type", "project")
    .eq("source_id", projectId)
    .eq("relationship_type", "developed_by")
    .eq("target_type", "company");
  const companyIds = [
    ...new Set(
      [developerCompanyId, ...((developedByRows ?? []).map((r) => r.target_id as string))].filter(
        (id): id is string => !!id,
      ),
    ),
  ];
  if (companyIds.length === 0) return [];

  const { data: companyRows, error: companyRelError } = await client
    .from("entity_relationship")
    .select("relationship_type, source_id")
    .eq("source_type", "person")
    .eq("target_type", "company")
    .in("target_id", companyIds);
  if (companyRelError) throw new Error(`Error obteniendo stakeholders: ${companyRelError.message}`);
  return resolveStakeholders(
    client,
    (companyRows ?? []).map((r) => ({ relationship_type: r.relationship_type as string, source_id: r.source_id as string })),
  );
}

export interface RegionBubble {
  region: string;
  lat: number;
  lng: number;
  count: number;
  capacityMw: number;
}

export interface MapPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  technology: string | null;
  capacityMw: number | null;
}

export interface MapData {
  regionBubbles: RegionBubble[];
  precisePoints: MapPoint[];
}

/**
 * Datos para el mapa: burbujas por región (aproximado, ver
 * chileRegionCentroids.ts) más los pocos proyectos que ya tienen coordenadas
 * precisas (location.latitude/longitude, cargadas desde el Formulario Nivel 2).
 */
export async function getProjectsForMap(client: SupabaseClient, filters: ProjectFilters = {}): Promise<MapData> {
  const technologyCodes = filters.technologyCodes ?? (filters.technologyCode ? [filters.technologyCode] : []);
  const namePatterns = filters.namePatterns ?? [];
  const technologyIds = await resolveTechnologyIds(client, technologyCodes);
  const hasTechFilter = technologyIds.length > 0;
  const hasNameFilter = namePatterns.length > 0;

  // Burbujas: agregadas en SQL (get_map_region_bubbles) — el conteo por región
  // no debe calcularse trayendo todas las filas a Node (ver getDashboardStats).
  // Esta RPC sí acepta el arreglo de códigos directamente (resuelve el join
  // dentro de SQL, no vía filtro embebido de PostgREST — no le aplica el bug de abajo).
  const bubblesQuery = client.rpc("get_map_region_bubbles", {
    p_technology_codes: technologyCodes.length > 0 ? technologyCodes : null,
  });

  // Puntos precisos: hoy son pocos (solo proyectos con Formulario Nivel 2 ya
  // procesado), así que traer las filas directamente es seguro. Se filtra por
  // `technology_id` (columna plana), no por `technology.code` (embed) — ver
  // comentario de resolveTechnologyIds: esta instancia de PostgREST no puede
  // parsear un or() que referencie una columna embebida en absoluto.
  let pointsQuery = client
    .from("project")
    .select("id, name, capacity_mw, technology:technology_id(code, name), location:location_id!inner(latitude, longitude)")
    .not("location.latitude", "is", null)
    .not("location.longitude", "is", null);

  if (hasTechFilter && hasNameFilter) {
    pointsQuery = pointsQuery.or([`technology_id.in.(${technologyIds.join(",")})`, ...namePatterns.map((p) => `name.ilike.%${p}%`)].join(","));
  } else if (hasTechFilter) {
    pointsQuery = technologyIds.length === 1 ? pointsQuery.eq("technology_id", technologyIds[0]) : pointsQuery.in("technology_id", technologyIds);
  } else if (hasNameFilter) {
    pointsQuery = pointsQuery.or(namePatterns.map((p) => `name.ilike.%${p}%`).join(","));
  } else if (technologyCodes.length > 0) {
    pointsQuery = pointsQuery.eq("technology_id", "00000000-0000-0000-0000-000000000000");
  }
  if (filters.search && filters.search.trim()) pointsQuery = pointsQuery.ilike("name", `%${filters.search.trim()}%`);

  const [{ data: bubbleRows, error: bubbleError }, { data: pointRows, error: pointError }] = await Promise.all([
    bubblesQuery,
    pointsQuery,
  ]);
  if (bubbleError) throw new Error(`Error obteniendo burbujas del mapa: ${bubbleError.message}`);
  if (pointError) throw new Error(`Error obteniendo puntos del mapa: ${pointError.message}`);

  const regionBubbles: RegionBubble[] = ((bubbleRows ?? []) as Array<{ region: string; count: number; capacity_mw: number }>)
    .map((row) => {
      const centroid = CHILE_REGION_CENTROIDS[row.region];
      return centroid ? { region: row.region, lat: centroid.lat, lng: centroid.lng, count: row.count, capacityMw: row.capacity_mw } : null;
    })
    .filter((b): b is RegionBubble => b !== null);

  const precisePoints: MapPoint[] = ((pointRows ?? []) as unknown as Array<{
    id: string;
    name: string;
    capacity_mw: number | null;
    technology: { name: string } | null;
    location: { latitude: number | null; longitude: number | null } | null;
  }>)
    .filter((row) => row.location?.latitude && row.location?.longitude)
    .map((row) => ({
      id: row.id,
      name: row.name,
      lat: row.location!.latitude!,
      lng: row.location!.longitude!,
      technology: row.technology?.name ?? null,
      capacityMw: row.capacity_mw,
    }));

  return { regionBubbles, precisePoints };
}

export interface SimilarProject {
  id: string;
  name: string;
  capacityMw: number | null;
  region: string | null;
  status: string | null;
  estimatedConnectionDate: string | null;
  similarity: number; // 0-100 — score determinístico, no un modelo de IA
}

/**
 * "Proyecto espejo" — determinístico, no IA: puntúa candidatos de la misma
 * tecnología por cercanía en potencia, misma región, misma clasificación
 * PMGD/Utility y mismo nivel de tensión, y devuelve los más parecidos. Sirve
 * para ver dónde están HOY proyectos comparables (estado, fecha estimada),
 * no para inferir cuánto demoró el proyecto similar en tramitarse — no
 * tenemos esa fecha real (ver antigüedad de la cartera).
 */
export async function getSimilarProjects(
  client: SupabaseClient,
  target: { id: string; technologyCode: string | null; capacityMw: number | null; region: string | null; voltageLevel: string | null },
  limit = 5,
): Promise<SimilarProject[]> {
  if (!target.technologyCode) return [];

  const { data: techRow } = await client.from("technology").select("id").eq("code", target.technologyCode).maybeSingle();
  if (!techRow) return [];

  const { data, error } = await client
    .from("project")
    .select(
      "id, name, capacity_mw, status, estimated_connection_date, location:location_id(region:region_id(name)), project_connection(voltage_level)",
    )
    .eq("technology_id", techRow.id)
    .neq("id", target.id)
    .not("status", "in", `(${REJECTED_STATUSES.join(",")})`)
    .limit(300);
  if (error) throw new Error(`Error buscando proyectos similares: ${error.message}`);

  const targetIsPmgd = target.capacityMw !== null && target.capacityMw <= PMGD_CAPACITY_THRESHOLD_MW;

  const scored = ((data ?? []) as unknown as Array<{
    id: string;
    name: string;
    capacity_mw: number | null;
    status: string | null;
    estimated_connection_date: string | null;
    location: { region: { name: string } | null } | null;
    project_connection: Array<{ voltage_level: string | null }>;
  }>).map((r) => {
    const region = r.location?.region?.name ?? null;
    const voltageLevel = r.project_connection?.[0]?.voltage_level ?? null;
    const isPmgd = r.capacity_mw !== null && r.capacity_mw <= PMGD_CAPACITY_THRESHOLD_MW;

    let score = 40; // misma tecnología — ya filtrada en la consulta
    if (isPmgd === targetIsPmgd) score += 15;
    if (region && target.region && region === target.region) score += 20;
    if (voltageLevel && target.voltageLevel && voltageLevel === target.voltageLevel) score += 10;
    if (target.capacityMw && r.capacity_mw) {
      const diffRatio = Math.abs(r.capacity_mw - target.capacityMw) / target.capacityMw;
      score += 15 * Math.max(0, 1 - diffRatio);
    }

    return {
      id: r.id,
      name: r.name,
      capacityMw: r.capacity_mw,
      region,
      status: r.status,
      estimatedConnectionDate: r.estimated_connection_date,
      similarity: Math.round(Math.min(score, 100)),
    };
  });

  return scored.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
}
