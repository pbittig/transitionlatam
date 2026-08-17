import type { SupabaseClient } from "@supabase/supabase-js";
import { CHILE_REGION_CENTROIDS } from "@/lib/shared/chileRegionCentroids";
import { contactRoleLabelEs } from "@/lib/shared/contactRoleLabels";
import { PMGD_CAPACITY_THRESHOLD_MW } from "@/lib/shared/projectPhaseDurations";
import type { VerificationSuggestion } from "@/lib/ai/verification/glmSuggestion";
import { normalizeForMatch } from "@/lib/ingestion/sources/energia-abierta/listado/normalize";
import { getReverificationPassStart } from "@/lib/data-access/reverificationPass";

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
  /** Pone arriba los proyectos con obra en curso registrada en PGP. */
  constructionFirst?: boolean;
}

export const REJECTED_STATUSES = ["Rechazada", "Desistida"];

export function startOfCurrentMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Días de observación que se le dan a un proyecto después de la fecha de
 * conexión que declaró. No es cortesía: es el plazo para detectar si la obra
 * arranca. La fecha declarada es sistemáticamente optimista (contra la propia
 * estimación del titular en PGP la desviación promedio es de +750 días), así
 * que sacar el proyecto el día siguiente al vencimiento perdía proyectos vivos.
 */
export const VIGENCIA_GRACE_DAYS = 100;

/** Prefijo del estado "declarado en construcción" — sin tilde ni final, porque la fuente mezcla "construcción"/"construccion"/mayúsculas. */
const DECLARED_CONSTRUCTION_PREFIX = "Proyecto declarado en construc";

function graceCutoffIso(): string {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - VIGENCIA_GRACE_DAYS);
  return cutoff.toISOString().slice(0, 10);
}

/**
 * Las dos caras de la regla de vigencia, como cláusulas `or()` de PostgREST.
 * Viven acá y no duplicadas en cada consumidor porque ya pasó una vez: el
 * listado y la cola del verificador tenían dos definiciones distintas de
 * "vigente" y el comentario de una decía que usaba el criterio de la otra.
 */
function aliveOrClause(sets: ConstructionSets): string {
  return [
    `estimated_connection_date.gte.${graceCutoffIso()}`,
    "estimated_connection_date.is.null",
    `status.ilike.${DECLARED_CONSTRUCTION_PREFIX}*`,
    ...(sets.underConstructionIds.length ? [`id.in.(${sets.underConstructionIds.join(",")})`] : []),
  ].join(",");
}

function historicOrClause(sets: ConstructionSets): string {
  const expired = [
    `estimated_connection_date.lt.${graceCutoffIso()}`,
    `status.not.ilike.${DECLARED_CONSTRUCTION_PREFIX}*`,
    ...(sets.underConstructionIds.length ? [`id.not.in.(${sets.underConstructionIds.join(",")})`] : []),
  ];
  return [
    `status.in.(${REJECTED_STATUSES.join(",")})`,
    ...(sets.builtIds.length ? [`id.in.(${sets.builtIds.join(",")})`] : []),
    `and(${expired.join(",")})`,
  ].join(",");
}

/**
 * Aplica el alcance "pipeline vigente" a cualquier query sobre `project`, con
 * el mismo criterio que el listado y la cola del verificador. Existe para que
 * ningún consumidor tenga que reescribir la regla —así fue como aparecieron
 * tres definiciones distintas de "vigente" conviviendo, dos de ellas en la
 * misma pantalla.
 *
 * `columnPrefix` permite aplicarla sobre un embed (ej. "project." cuando se
 * consulta `seia_record` con `project:project_id!inner`).
 */
export async function applyVigenteScope<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- el builder de supabase-js encadena por mutación de tipo; mismo criterio que applyPeriodFilter.
  T extends { not: (...args: any[]) => T; or: (...args: any[]) => T },
>(client: SupabaseClient, query: T): Promise<T> {
  const sets = await resolveConstructionSets(client);
  const scoped = query.not("status", "in", `(${REJECTED_STATUSES.join(",")})`).or(aliveOrClause(sets));
  return sets.builtIds.length ? scoped.not("id", "in", `(${sets.builtIds.join(",")})`) : scoped;
}

/**
 * La misma regla de vigencia evaluada en Node, para las consultas que no pueden
 * filtrarla en la base: esta instancia de PostgREST no parsea un `or()` que
 * referencie una columna de un recurso embebido (mismo límite documentado en
 * resolveTechnologyIds), así que una query sobre `seia_record` con
 * `project:project_id!inner(...)` no puede usar applyVigenteScope.
 */
export async function buildVigenciaPredicate(
  client: SupabaseClient,
): Promise<(project: { id: string; status: string | null; estimated_connection_date: string | null }) => boolean> {
  const sets = await resolveConstructionSets(client);
  const built = new Set(sets.builtIds);
  const underConstruction = new Set(sets.underConstructionIds);
  const cutoff = graceCutoffIso();
  const declaredPrefix = DECLARED_CONSTRUCTION_PREFIX.toLowerCase();
  return (project) => {
    if (project.status && REJECTED_STATUSES.includes(project.status)) return false;
    if (built.has(project.id)) return false;
    if (underConstruction.has(project.id)) return true;
    if (!project.estimated_connection_date) return true;
    const normalizedStatus = (project.status ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    if (normalizedStatus.startsWith(declaredPrefix)) return true;
    return project.estimated_connection_date >= cutoff;
  };
}

interface ConstructionSets {
  /** Obra terminada según PGP (100%) — salen a histórico aunque su fecha declarada sea futura. */
  builtIds: string[];
  /** En PGP sin terminar (<100%) — se quedan vigentes hasta que estén construidos, aunque la ventana haya vencido. */
  underConstructionIds: string[];
}

/**
 * Un proyecto es vigente mientras no esté construido. El avance de PGP manda
 * sobre la fecha declarada en las dos direcciones: si está en PGP y no llegó a
 * 100% se queda aunque la ventana de observación haya vencido, y si llegó a
 * 100% sale aunque la fecha declarada sea futura.
 *
 * Los ids se resuelven acá y se pasan a la query como listas porque
 * `latest_pgp_project_progress` es otra relación y PostgREST no puede filtrar
 * `project` por una columna de un embed (mismo motivo documentado en
 * resolveTechnologyIds). Son conjuntos chicos y acotados: PGP sólo cubre
 * proyectos que ya declararon construcción.
 */
async function resolveConstructionSets(client: SupabaseClient): Promise<ConstructionSets> {
  const { data, error } = await client.from("latest_pgp_project_progress").select("project_id, progress_percent");
  // La vista puede no existir todavía en una base sin la migración aplicada, y
  // su policy exige rol `authenticated`: en ambos casos se sigue sin PGP en vez
  // de tumbar el listado — el filtro queda en la ventana de observación sola.
  if (error) return { builtIds: [], underConstructionIds: [] };
  const builtIds: string[] = [];
  const underConstructionIds: string[] = [];
  for (const row of data ?? []) {
    const percent = Number(row.progress_percent);
    if (!Number.isFinite(percent)) continue;
    (percent >= 100 ? builtIds : underConstructionIds).push(row.project_id as string);
  }
  return { builtIds, underConstructionIds };
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
    // Vigente = todavía no está construido, y alguna razón para seguir esperándolo:
    //   · la ventana de observación sigue abierta (COD + 100 días),
    //   · o no tiene fecha declarada (no podemos afirmar que se le pasó),
    //   · o está declarado en construcción (vivo administrativamente aunque no
    //     tengamos su obra en PGP: la ausencia de PGP es un hueco de cobertura
    //     nuestro, no evidencia de que no se construye),
    //   · o está en PGP sin terminar (obra en curso, sigue hasta el 100%).
    // Rechazada/Desistida se excluyen aunque su fecha quede en el futuro (hallazgo
    // real: se colaban acá porque sólo se filtraba por fecha, no por estado).
    const sets = await resolveConstructionSets(client);
    query = query.not("status", "in", `(${REJECTED_STATUSES.join(",")})`).or(aliveOrClause(sets));
    if (sets.builtIds.length) query = query.not("id", "in", `(${sets.builtIds.join(",")})`);
    query = query.order("estimated_connection_date", { ascending: true });
  } else if (filters.connectionPeriod === "historico_completo") {
    // Complemento exacto de "upcoming": rechazado/desistido, obra terminada, o
    // ventana vencida sin ninguna señal de que siga vivo.
    query = query.or(historicOrClause(await resolveConstructionSets(client))).order("estimated_connection_date", { ascending: false });
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

  /**
   * Sube al principio los proyectos con obra en curso registrada en PGP.
   *
   * Se hace acá y no en la consulta porque el avance vive en
   * `latest_pgp_project_progress`, otra relación, y PostgREST no ordena por
   * ella: intentarlo devuelve "failed to parse order". Tampoco se puede ordenar
   * por pertenencia a una lista de ids — no admite expresiones en el `order`.
   *
   * LA LIMITACIÓN, EXPLÍCITA: esto reordena la página que ya vino, no el
   * conjunto entero. Sirve porque son 17 proyectos con obra sobre 238 y el
   * orden base es por fecha de conexión, así que caen casi todos en las
   * primeras páginas; pero uno con fecha lejana puede quedar en una página
   * posterior y no subir a la primera. Ordenarlo de verdad exigiría traer todos
   * los ids del conjunto filtrado para ordenarlos en memoria antes de paginar.
   */
  if (filters.constructionFirst && data?.length) {
    const conObra = new Set((await resolveConstructionSets(client)).underConstructionIds);
    (data as Array<{ id: string }>).sort((a, b) => Number(conObra.has(b.id)) - Number(conObra.has(a.id)));
  }

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
  /** Paño de la subestación y segmento de transmisión — vienen del listado de Acceso Abierto (99% y 97% poblados). */
  substationBay: string | null;
  transmissionSegment: string | null;
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
      "id, name, internal_code, external_reference, nup, capacity_mw, capacity_mwh, net_injection_mw, net_withdrawal_mw, generation_capacity_mw, storage_capacity_mw, storage_hours, includes_storage, status, estimated_connection_date, verified_at, editorial_status, ai_screened_at, ai_data_sanity, ai_data_sanity_reason, ai_seia_pick, ai_seia_pick_reason, project_kind, developer_company_id, technology:technology_id(name, code), location:location_id(comuna, region:region_id(name)), country:country_id(code), developer:developer_company_id(name, rut, legal_address), spv:spv_id(name), project_connection(connection_point, voltage_level, request_type, substation_bay, transmission_segment)",
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
    project_connection: Array<{ connection_point: string | null; voltage_level: string | null; request_type: string | null; substation_bay: string | null; transmission_segment: string | null }>;
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
    substationBay: connection?.substation_bay ?? null,
    transmissionSegment: connection?.transmission_segment ?? null,
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

export type VerificationPack = "pack1" | "pack2" | "recover";
/** Dentro de un pack: lo que falta, lo que toca repasar, o todo junto. */
export type VerificationScope = "pendientes" | "verificados" | "todos";

/**
 * Los paquetes de trabajo del Verificador, por fecha de conexión estimada.
 *
 * La cola completa son ~963 proyectos vivos y en alcance: demasiados para
 * atacarlos como una sola lista, y sin ningún orden que diga cuál importa
 * primero. Se parte por cuándo entra en operación, que es lo que le da urgencia
 * comercial a verificar una ficha.
 *
 * `pack2` se lleva los que no tienen fecha estimada. Es a propósito: son 23 y
 * dejarlos sin pack los volvería invisibles, que es justo lo que este corte
 * viene a evitar. Si alguna vez se les puebla la fecha, se reubican solos.
 *
 * `recover` son los que ya deberían estar operando y no lo están. Van al final
 * por decisión del usuario (2026-08-13): la fecha vencida hace sospechar que
 * muchos están muertos sin que nadie lo haya declarado.
 */
export const VERIFICATION_PACKS: Record<
  VerificationPack,
  { label: string; hint: string; desde: string | null; hasta: string | null; incluyeSinFecha: boolean }
> = {
  pack1: {
    label: "Pack 1",
    hint: "Entran en operación entre junio 2026 y diciembre 2027",
    desde: "2026-06-01",
    hasta: "2027-12-31",
    incluyeSinFecha: false,
  },
  pack2: {
    label: "Pack 2",
    hint: "Entran en operación desde enero 2028, más los que no tienen fecha",
    desde: "2028-01-01",
    hasta: null,
    incluyeSinFecha: true,
  },
  recover: {
    label: "Recover",
    hint: "Fecha de conexión ya vencida — se revisan al final",
    desde: null,
    hasta: "2026-05-31",
    incluyeSinFecha: false,
  },
};

/**
 * Acota la consulta al pack pedido. Se aplica como AND sobre lo que ya traiga
 * `query`, igual que applyPeriodFilter.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- misma razón que applyPeriodFilter: el builder de supabase-js encadena por mutación de tipo.
function applyPackFilter<T extends { gte: (...args: any[]) => T; lte: (...args: any[]) => T; or: (...args: any[]) => T }>(
  query: T,
  pack: VerificationPack,
): T {
  const { desde, hasta, incluyeSinFecha } = VERIFICATION_PACKS[pack];
  if (incluyeSinFecha) {
    // `or` y no `gte` + `is`: sin el or, los nulos se caen del resultado.
    const partes = [desde ? `estimated_connection_date.gte.${desde}` : null, "estimated_connection_date.is.null"].filter(
      Boolean,
    );
    return query.or(partes.join(","));
  }
  let scoped = query;
  if (desde) scoped = scoped.gte("estimated_connection_date", desde);
  if (hasta) scoped = scoped.lte("estimated_connection_date", hasta);
  return scoped;
}

/**
 * Exactamente el mismo criterio "vigente vs histórico" que /proyectos-esperados
 * (connectionPeriod "upcoming"/"historico_completo" en listProjects): comparten
 * aliveOrClause/historicOrClause, así que no pueden volver a divergir. Vigente =
 * no rechazado, no construido, y con alguna razón para seguir esperándolo
 * (ventana de observación abierta, sin fecha, declarado en construcción, o con
 * obra en curso en PGP). Aplicado como filtro AND sobre lo que ya traiga
 * `query` — no reemplaza otros filtros.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- el query builder de supabase-js encadena por mutación de tipo, sin un Database tipado no vale la pena reconstruir su firma acá (mismo criterio pragmático que el resto de este archivo con updates dinámicos).
function applyPeriodFilter<T extends { not: (...args: any[]) => T; gte: (...args: any[]) => T; or: (...args: any[]) => T }>(
  query: T,
  period: VerificationPeriod,
  sets: ConstructionSets,
): T {
  if (period === "vigente") {
    const alive = query.not("status", "in", `(${REJECTED_STATUSES.join(",")})`).or(aliveOrClause(sets));
    return sets.builtIds.length ? alive.not("id", "in", `(${sets.builtIds.join(",")})`) : alive;
  }
  return query.or(historicOrClause(sets));
}

export interface VerificationPackStats {
  pack: VerificationPack;
  pendientes: number;
  verificados: number;
  total: number;
}

/**
 * Cuántos proyectos hay en cada pack — para los botones de /admin/verificador.
 *
 * Cuenta sobre la misma base que la cola (publicado, en alcance, no caído), así
 * que el número del botón es el número de filas que va a mostrar. Se pide en
 * paralelo y con `head: true`: son 6 conteos y ninguno trae filas.
 */
export async function getVerificationPackStats(client: SupabaseClient): Promise<VerificationPackStats[]> {
  const packs: VerificationPack[] = ["pack1", "pack2", "recover"];
  // Se lee una sola vez: son 6 conteos y el corte es el mismo para todos.
  const inicioRepaso = await getReverificationPassStart(client);
  const contar = async (pack: VerificationPack, scope: Exclude<VerificationScope, "todos">) => {
    let query = client
      .from("project")
      .select("id", { count: "exact", head: true })
      .or("prefilter_status.neq.out_of_scope,prefilter_status.is.null")
      .eq("editorial_status", "published")
      .not("status", "in", `(${ESTADOS_CAIDOS.map((e) => `"${e}"`).join(",")})`);
    if (scope === "pendientes") {
      query = query.is("verified_at", null);
    } else {
      // El contador tiene que decir lo que FALTA repasar, no cuántas fichas
      // están verificadas: si dijera lo segundo, no bajaría al trabajar y el
      // número sería exactamente igual de inútil que la lista que no se vaciaba.
      query = query.not("verified_at", "is", null);
      if (inicioRepaso) query = query.lt("verified_at", inicioRepaso);
    }
    const { count, error } = await applyPackFilter(query, pack);
    if (error) throw new Error(`Error contando el ${pack}: ${error.message}`);
    return count ?? 0;
  };

  const resultados = await Promise.all(
    packs.map(async (pack) => {
      const [pendientes, verificados] = await Promise.all([contar(pack, "pendientes"), contar(pack, "verificados")]);
      return { pack, pendientes, verificados, total: pendientes + verificados };
    }),
  );
  return resultados;
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
  pack?: VerificationPack,
  scope: VerificationScope = "pendientes",
): Promise<VerificationQueueItem[]> {
  if (sort || period || pack) {
    let query = client
      .from("project")
      .select(VERIFICATION_QUEUE_SELECT)
      .or("prefilter_status.neq.out_of_scope,prefilter_status.is.null")
      .eq("editorial_status", "published");

    // Los caídos viven en /admin/boveda y ni siquiera se le muestran al cliente
    // (ver 20260813000000_restrict_project_visibility.sql). Verificarlos es
    // trabajo que nadie va a mirar.
    if (pack) query = query.not("status", "in", `(${ESTADOS_CAIDOS.map((e) => `"${e}"`).join(",")})`);

    if (scope === "pendientes") query = query.is("verified_at", null);
    else if (scope === "verificados") {
      query = query.not("verified_at", "is", null);
      // La cola del repaso es lo verificado ANTES de que empezara la vuelta:
      // al re-verificar, verified_at pasa a ser posterior y la ficha sale sola.
      // Sin corte, todo lo verificado cuenta como pendiente de repasar.
      const inicio = await getReverificationPassStart(client);
      if (inicio) query = query.lt("verified_at", inicio);
    }

    if (pack) query = applyPackFilter(query, pack);
    if (period) query = applyPeriodFilter(query, period, await resolveConstructionSets(client));

    if (sort) {
      query = query.order(VERIFICATION_SORT_COLUMNS[sort.column], { ascending: sort.direction === "asc", nullsFirst: false });
    } else if (pack) {
      // Dentro de un pack manda la fecha de conexión: primero lo que entra antes.
      query = query.order("estimated_connection_date", { ascending: true, nullsFirst: false });
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
      .eq("editorial_status", "published")
      .is("verified_at", null)
      .not("status", "in", `(${REJECTED_STATUSES.join(",")})`)
      .gte("estimated_connection_date", startOfMonth)
      .order("estimated_connection_date", { ascending: true })
      .limit(limit),
    client
      .from("project")
      .select(VERIFICATION_QUEUE_SELECT)
      .or("prefilter_status.neq.out_of_scope,prefilter_status.is.null")
      .eq("editorial_status", "published")
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

export interface ReverificationQueueItem {
  id: string;
  name: string;
  internalCode: string;
  comuna: string | null;
  region: string | null;
  status: string | null;
  verifiedAt: string | null;
  reverificationReason: string | null;
}

const REVERIFICATION_QUEUE_SELECT =
  "id, name, internal_code, status, verified_at, reverification_reason, location:location_id(comuna, region:region_id(name))";

type ReverificationQueueRow = {
  id: string;
  name: string;
  internal_code: string;
  status: string | null;
  verified_at: string | null;
  reverification_reason: string | null;
  location: { comuna: string | null; region: { name: string } | null } | null;
};

function mapReverificationQueueRow(row: ReverificationQueueRow): ReverificationQueueItem {
  return {
    id: row.id,
    name: row.name,
    internalCode: row.internal_code,
    comuna: row.location?.comuna ?? null,
    region: row.location?.region?.name ?? null,
    status: row.status,
    verifiedAt: row.verified_at,
    reverificationReason: row.reverification_reason,
  };
}

/**
 * Los estados que sacan a un proyecto de la vista del cliente por estar caído.
 *
 * Vive acá y no en la policy solamente porque la bóveda tiene que listar
 * exactamente lo mismo que la policy esconde. Si los dos lados se escriben por
 * separado, el día que aparezca un tercer estado terminal la bóveda deja de
 * mostrar lo que el cliente dejó de ver, y nadie se entera.
 * Ver `supabase/migrations/20260813000000_restrict_project_visibility.sql`.
 */
export const ESTADOS_CAIDOS = ["Rechazada", "Desistida"] as const;

export interface FallenProjectItem {
  id: string;
  name: string;
  internalCode: string;
  comuna: string | null;
  region: string | null;
  status: string | null;
  technology: string | null;
  capacityMw: number | null;
  developer: string | null;
  editorialStatus: string | null;
}

const FALLEN_PROJECT_SELECT =
  "id, name, internal_code, status, capacity_mw, editorial_status, technology:technology_id(name), developer:developer_company_id(name), location:location_id(comuna, region:region_id(name))";

type FallenProjectRow = {
  id: string;
  name: string;
  internal_code: string;
  status: string | null;
  capacity_mw: number | null;
  editorial_status: string | null;
  technology: { name: string } | null;
  developer: { name: string } | null;
  location: { comuna: string | null; region: { name: string } | null } | null;
};

/**
 * Proyectos rechazados o desistidos — la bóveda de /admin/boveda.
 *
 * Se consulta siempre con el cliente de servicio: la policy de `project` los
 * esconde, así que con la sesión del usuario esta función devolvería vacío.
 */
export async function getFallenProjects(
  client: SupabaseClient,
  options: { status?: string; search?: string; page?: number; pageSize?: number } = {},
): Promise<{ items: FallenProjectItem[]; total: number }> {
  const pageSize = options.pageSize ?? 50;
  const page = Math.max(1, options.page ?? 1);
  const estados = options.status && (ESTADOS_CAIDOS as readonly string[]).includes(options.status)
    ? [options.status]
    : [...ESTADOS_CAIDOS];

  let query = client
    .from("project")
    .select(FALLEN_PROJECT_SELECT, { count: "exact" })
    .in("status", estados);

  const search = options.search?.trim();
  if (search) query = query.or(`name.ilike.%${search}%,internal_code.ilike.%${search}%`);

  const { data, error, count } = await query
    .order("name", { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(`Error obteniendo proyectos caídos: ${error.message}`);

  const items = ((data ?? []) as unknown as FallenProjectRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    internalCode: row.internal_code,
    comuna: row.location?.comuna ?? null,
    region: row.location?.region?.name ?? null,
    status: row.status,
    technology: row.technology?.name ?? null,
    capacityMw: row.capacity_mw,
    developer: row.developer?.name ?? null,
    editorialStatus: row.editorial_status,
  }));
  return { items, total: count ?? 0 };
}

/** Conteo de la bóveda — para la tarjeta de /admin. */
export async function countFallenProjects(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from("project")
    .select("id", { count: "exact", head: true })
    .in("status", [...ESTADOS_CAIDOS]);
  if (error) throw new Error(`Error contando proyectos caídos: ${error.message}`);
  return count ?? 0;
}

/** Proyectos ya verificados cuyo estado cambió de forma sospechosa desde entonces (ver load.ts). */
export async function getReverificationQueue(client: SupabaseClient, limit = 200): Promise<ReverificationQueueItem[]> {
  const { data, error } = await client
    .from("project")
    .select(REVERIFICATION_QUEUE_SELECT)
    .eq("needs_reverification", true)
    .order("verified_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Error obteniendo cola de re-verificación: ${error.message}`);
  return ((data ?? []) as unknown as ReverificationQueueRow[]).map(mapReverificationQueueRow);
}

export async function countNeedsReverification(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from("project")
    .select("id", { count: "exact", head: true })
    .eq("needs_reverification", true);
  if (error) throw new Error(`Error contando proyectos por re-verificar: ${error.message}`);
  return count ?? 0;
}

/** Conteo total de proyectos sin verificar — para la tarjeta de /admin. */
export async function countUnverifiedProjects(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from("project")
    .select("id", { count: "exact", head: true })
    .or("prefilter_status.neq.out_of_scope,prefilter_status.is.null")
    .eq("editorial_status", "published")
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
  pack?: VerificationPack,
): Promise<VerificationQueueItem[]> {
  let query = client
    .from("project")
    .select(VERIFICATION_QUEUE_SELECT)
    .or("prefilter_status.neq.out_of_scope,prefilter_status.is.null")
    .eq("editorial_status", "published")
    .is("verified_at", null)
    .or("ai_data_sanity.eq.sospechoso,ai_seia_pick.not.is.null");
  // Acepta pack para que "solo dudosos" siga siendo un filtro DENTRO del pack
  // que se está trabajando, y no un salto a otra lista.
  if (pack) {
    query = query.not("status", "in", `(${ESTADOS_CAIDOS.map((e) => `"${e}"`).join(",")})`);
    query = applyPackFilter(query, pack);
  }
  if (period) query = applyPeriodFilter(query, period, await resolveConstructionSets(client));

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
      client.from("project").select("id", { count: "exact", head: true }).or("prefilter_status.neq.out_of_scope,prefilter_status.is.null").eq("editorial_status", "published").is("verified_at", null),
      client.from("project").select("id", { count: "exact", head: true }).or("prefilter_status.neq.out_of_scope,prefilter_status.is.null").not("ai_screened_at", "is", null),
      client
        .from("project")
        .select("id", { count: "exact", head: true })
        .or("prefilter_status.neq.out_of_scope,prefilter_status.is.null")
        .eq("editorial_status", "published")
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
  const sets = await resolveConstructionSets(client);
  const [{ count: vigentePending, error: e1 }, { count: historicoPending, error: e2 }] = await Promise.all([
    applyPeriodFilter(client.from("project").select("id", { count: "exact", head: true }).or("prefilter_status.neq.out_of_scope,prefilter_status.is.null").eq("editorial_status", "published").is("verified_at", null), "vigente", sets),
    applyPeriodFilter(client.from("project").select("id", { count: "exact", head: true }).or("prefilter_status.neq.out_of_scope,prefilter_status.is.null").eq("editorial_status", "published").is("verified_at", null), "historico", sets),
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
  const sets = await resolveConstructionSets(client);
  const startOfDay = `${todayInChile}T00:00:00-04:00`;
  const endOfDay = `${todayInChile}T23:59:59.999-04:00`;

  const [{ count: verified, error: e1 }, { count: total, error: e2 }, { count: verifiedToday, error: e3 }] =
    await Promise.all([
      applyPeriodFilter(
        client.from("project").select("id", { count: "exact", head: true }).or("prefilter_status.neq.out_of_scope,prefilter_status.is.null"),
        "vigente",
        sets,
      ).not("verified_at", "is", null),
      applyPeriodFilter(
        client.from("project").select("id", { count: "exact", head: true }).or("prefilter_status.neq.out_of_scope,prefilter_status.is.null"),
        "vigente",
        sets,
      ),
      applyPeriodFilter(
        client.from("project").select("id", { count: "exact", head: true }).or("prefilter_status.neq.out_of_scope,prefilter_status.is.null"),
        "vigente",
        sets,
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
  const sets = await resolveConstructionSets(client);
  // Mismo shape de query en ambas llamadas a applyPeriodFilter (el filtro de
  // verified_at se encadena DESPUÉS) — pasarle chains con formas distintas dispara
  // "Type instantiation is excessively deep" en el genérico T (hallazgo real).
  const [{ count: verified, error: e1 }, { count: total, error: e2 }] = await Promise.all([
    applyPeriodFilter(client.from("project").select("id", { count: "exact", head: true }), "vigente", sets).not("verified_at", "is", null),
    applyPeriodFilter(client.from("project").select("id", { count: "exact", head: true }), "vigente", sets),
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

export type RelatedProjectReason = "same_spv" | "same_owner" | "same_rut" | "same_group" | "shared_contacts";

const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "hotmail.com", "outlook.com", "live.com", "yahoo.com", "icloud.com", "me.com", "proton.me", "protonmail.com",
]);

export interface RelatedPortfolioProject {
  id: string;
  name: string;
  capacityMw: number | null;
  capacityMwh: number | null;
  generationCapacityMw: number | null;
  storageCapacityMw: number | null;
  estimatedConnectionDate: string | null;
  technologyCode: string | null;
  includesStorage: boolean;
  status: string | null;
  reason: RelatedProjectReason;
}

/**
 * Cartera vinculada por estructura corporativa, no por parecido. Solo devuelve
 * fichas verificadas del pipeline vigente.
 */
export async function getRelatedPortfolioProjects(
  client: SupabaseClient,
  target: {
    id: string;
    developerCompanyId: string | null;
    developerCompanyName: string | null;
    relatedCompanyNames?: string[];
  },
  limit = 8,
): Promise<RelatedPortfolioProject[]> {
  const { data: currentProject, error: currentError } = await client
    .from("project")
    .select("spv_id")
    .eq("id", target.id)
    .maybeSingle();
  if (currentError) throw new Error(`Error obteniendo SPV del proyecto: ${currentError.message}`);

  const currentSpvId = (currentProject?.spv_id as string | null | undefined) ?? null;
  let siblingSpvIds: string[] = [];

  if (currentSpvId) {
    const { data: currentSpv } = await client
      .from("spv")
      .select("parent_company_id")
      .eq("id", currentSpvId)
      .maybeSingle();
    const parentCompanyId = (currentSpv?.parent_company_id as string | null | undefined) ?? null;
    if (parentCompanyId) {
      const { data: siblingSpvs, error: siblingError } = await client
        .from("spv")
        .select("id")
        .eq("parent_company_id", parentCompanyId);
      if (siblingError) throw new Error(`Error obteniendo SPV relacionados: ${siblingError.message}`);
      siblingSpvIds = (siblingSpvs ?? []).map((row) => row.id as string);
    }
  }

  const officialGroupNames = new Set(
    [target.developerCompanyName, ...(target.relatedCompanyNames ?? [])]
      .filter((name): name is string => Boolean(name))
      .map(normalizeForMatch),
  );
  let groupCompanyIds: string[] = [];
  let sameRutCompanyIds: string[] = [];
  if (officialGroupNames.size > 0) {
    const { data: companies, error: companiesError } = await client.from("company").select("id, name").limit(5000);
    if (companiesError) throw new Error(`Error resolviendo empresas relacionadas: ${companiesError.message}`);
    groupCompanyIds = (companies ?? [])
      .filter((company) => officialGroupNames.has(normalizeForMatch(company.name as string)))
      .map((company) => company.id as string);
  }

  // El mismo titular puede existir duplicado con distinta grafía, pero el RUT
  // identifica inequívocamente a la misma entidad legal.
  if (target.developerCompanyId) {
    const { data: currentCompany } = await client.from("company").select("rut").eq("id", target.developerCompanyId).maybeSingle();
    if (currentCompany?.rut) {
      const { data: sameRutCompanies } = await client.from("company").select("id").eq("rut", currentCompany.rut);
      sameRutCompanyIds = (sameRutCompanies ?? []).map((company) => company.id as string);
      groupCompanyIds.push(...sameRutCompanyIds);
    }
  }

  // Una relación por personas exige dos contactos exactos compartidos. Además,
  // sus correos deben ser corporativos; compartir sólo un dominio o un asesor
  // aislado no basta para vincular carteras.
  const { data: currentContactRelations } = await client
    .from("entity_relationship")
    .select("source_id")
    .eq("source_type", "person")
    .eq("target_type", "project")
    .eq("target_id", target.id);
  const currentPersonIds = [...new Set((currentContactRelations ?? []).map((relation) => relation.source_id as string))];
  let contactRelatedProjectIds = new Set<string>();
  if (currentPersonIds.length >= 2) {
    const { data: people } = await client.from("person").select("id, email").in("id", currentPersonIds);
    const corporateEmails = [...new Set((people ?? []).filter((person) => {
      const domain = String(person.email ?? "").split("@")[1]?.toLowerCase();
      return domain && !PUBLIC_EMAIL_DOMAINS.has(domain);
    }).map((person) => String(person.email).trim().toLowerCase()))];
    if (corporateEmails.length >= 2) {
      const { data: matchingPeople } = await client.from("person").select("id, email").in("email", corporateEmails);
      const emailByPersonId = new Map((matchingPeople ?? []).map((person) => [person.id as string, String(person.email).trim().toLowerCase()]));
      const { data: sharedRelations } = await client
        .from("entity_relationship")
        .select("source_id, target_id")
        .eq("source_type", "person")
        .eq("target_type", "project")
        .in("source_id", [...emailByPersonId.keys()])
        .neq("target_id", target.id);
      const emailsByProject = new Map<string, Set<string>>();
      for (const relation of sharedRelations ?? []) {
        const emails = emailsByProject.get(relation.target_id as string) ?? new Set<string>();
        const email = emailByPersonId.get(relation.source_id as string);
        if (email) emails.add(email);
        emailsByProject.set(relation.target_id as string, emails);
      }
      contactRelatedProjectIds = new Set([...emailsByProject].filter(([, emails]) => emails.size >= 2).map(([projectId]) => projectId));
    }
  }

  const ownerIds = Array.from(
    new Set([target.developerCompanyId, ...groupCompanyIds].filter((id): id is string => Boolean(id))),
  );
  const spvIds = Array.from(new Set([currentSpvId, ...siblingSpvIds].filter((id): id is string => Boolean(id))));
  const relationshipFilters = [
    ownerIds.length > 0 ? `developer_company_id.in.(${ownerIds.join(",")})` : null,
    spvIds.length > 0 ? `spv_id.in.(${spvIds.join(",")})` : null,
    contactRelatedProjectIds.size > 0 ? `id.in.(${[...contactRelatedProjectIds].join(",")})` : null,
  ].filter((filter): filter is string => Boolean(filter));
  if (relationshipFilters.length === 0) return [];

  const { data, error } = await client
    .from("project")
    .select(
      "id, name, developer_company_id, spv_id, capacity_mw, capacity_mwh, generation_capacity_mw, storage_capacity_mw, estimated_connection_date, includes_storage, status, technology:technology_id(code)",
    )
    .neq("id", target.id)
    .not("verified_at", "is", null)
    .gte("estimated_connection_date", startOfCurrentMonthIso())
    .not("status", "in", `(${REJECTED_STATUSES.join(",")})`)
    .or(relationshipFilters.join(","))
    .order("estimated_connection_date", { ascending: true })
    .limit(Math.max(limit * 3, 24));
  if (error) throw new Error(`Error buscando proyectos relacionados: ${error.message}`);

  return ((data ?? []) as unknown as Array<{
    id: string;
    name: string;
    developer_company_id: string | null;
    spv_id: string | null;
    capacity_mw: number | null;
    capacity_mwh: number | null;
    generation_capacity_mw: number | null;
    storage_capacity_mw: number | null;
    estimated_connection_date: string | null;
    includes_storage: boolean;
    status: string | null;
    technology: { code: string } | null;
  }>)
    .map((row) => {
      const reason: RelatedProjectReason =
        currentSpvId && row.spv_id === currentSpvId
          ? "same_spv"
          : target.developerCompanyId && row.developer_company_id === target.developerCompanyId
            ? "same_owner"
            : sameRutCompanyIds.includes(row.developer_company_id ?? "")
              ? "same_rut"
            : ownerIds.includes(row.developer_company_id ?? "") || spvIds.includes(row.spv_id ?? "")
              ? "same_group"
              : "shared_contacts";
      return {
        id: row.id,
        name: row.name,
        capacityMw: row.capacity_mw,
        capacityMwh: row.capacity_mwh,
        generationCapacityMw: row.generation_capacity_mw,
        storageCapacityMw: row.storage_capacity_mw,
        estimatedConnectionDate: row.estimated_connection_date,
        technologyCode: row.technology?.code ?? null,
        includesStorage: row.includes_storage,
        status: row.status,
        reason,
      };
    })
    .slice(0, limit);
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
