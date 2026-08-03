import type { SupabaseClient } from "@supabase/supabase-js";
import { REJECTED_STATUSES, startOfCurrentMonthIso } from "./projects";

const PIPELINE_SYNC_SETTING_KEY = "pipeline_last_synced_at";
const PIPELINE_CURSOR_SETTING_KEY = "pipeline_sync_cursor";
const PIPELINE_SEEN_EXTERNAL_IDS_KEY = "pipeline_seen_external_ids";

export interface PipelineSyncCursor {
  lastExternalId: string | null;
  cycleStartedAt: string;
  processedInCycle: number;
}

export async function getPipelineSyncCursor(client: SupabaseClient): Promise<PipelineSyncCursor | null> {
  const { data, error } = await client
    .from("app_setting")
    .select("value")
    .eq("key", PIPELINE_CURSOR_SETTING_KEY)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer el cursor del pipeline: ${error.message}`);
  if (!data?.value || typeof data.value !== "object") return null;
  const value = data.value as Partial<PipelineSyncCursor>;
  if (typeof value.cycleStartedAt !== "string" || typeof value.processedInCycle !== "number") return null;
  return {
    lastExternalId: typeof value.lastExternalId === "string" ? value.lastExternalId : null,
    cycleStartedAt: value.cycleStartedAt,
    processedInCycle: value.processedInCycle,
  };
}

export async function savePipelineSyncCursor(client: SupabaseClient, cursor: PipelineSyncCursor): Promise<void> {
  const { error } = await client.from("app_setting").upsert({
    key: PIPELINE_CURSOR_SETTING_KEY,
    value: cursor,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`No se pudo guardar el cursor del pipeline: ${error.message}`);
}

export async function clearPipelineSyncCursor(client: SupabaseClient): Promise<void> {
  const { error } = await client.from("app_setting").delete().eq("key", PIPELINE_CURSOR_SETTING_KEY);
  if (error) throw new Error(`No se pudo reiniciar el cursor del pipeline: ${error.message}`);
}

export async function getPipelineSeenExternalIds(client: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await client
    .from("app_setting")
    .select("value")
    .eq("key", PIPELINE_SEEN_EXTERNAL_IDS_KEY)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer el registro de solicitudes revisadas: ${error.message}`);
  return new Set(Array.isArray(data?.value) ? data.value.filter((id): id is string => typeof id === "string") : []);
}

export async function addPipelineSeenExternalIds(client: SupabaseClient, externalIds: string[]): Promise<void> {
  if (externalIds.length === 0) return;
  const seen = await getPipelineSeenExternalIds(client);
  for (const externalId of externalIds) seen.add(externalId);
  const { error } = await client.from("app_setting").upsert({
    key: PIPELINE_SEEN_EXTERNAL_IDS_KEY,
    value: [...seen],
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`No se pudo guardar el registro de solicitudes revisadas: ${error.message}`);
}

/** Marca de tiempo de la última corrida exitosa del sync de listado (Acceso Abierto) — separado del sync de centrales CNE (power_plant.synced_at), que es manual. */
export async function getPipelineLastSyncedAt(client: SupabaseClient): Promise<string | null> {
  const { data, error } = await client
    .from("app_setting")
    .select("updated_at")
    .eq("key", PIPELINE_SYNC_SETTING_KEY)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer la fecha de sincronización del pipeline: ${error.message}`);
  if (data?.updated_at) return data.updated_at;

  // Compatibilidad para instalaciones que todavía no han ejecutado un sync
  // desde que se agregó app_setting: muestra la última actividad real del
  // listado y el próximo sync reemplazará este fallback por su hora exacta.
  const { data: latestEvent, error: latestEventError } = await client
    .from("project_event")
    .select("recorded_at")
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestEventError) {
    throw new Error(`No se pudo leer la última actividad del pipeline: ${latestEventError.message}`);
  }
  return latestEvent?.recorded_at ?? null;
}

/** Registra que el sync de listado acaba de correr — llamado al final de runListadoSync. */
export async function recordPipelineSync(client: SupabaseClient): Promise<void> {
  const { error } = await client
    .from("app_setting")
    .upsert({ key: PIPELINE_SYNC_SETTING_KEY, value: true, updated_at: new Date().toISOString() });
  if (error) throw new Error(`No se pudo registrar la sincronización del pipeline: ${error.message}`);
}

export interface PipelineFunnel {
  total: number;
  noRechazado: number;
  conSeia: number;
  conRca: number;
  etapaAvanzada: number;
  declaradoConstruccion: number;
}

/** Embudo del pipeline completo — cuántos proyectos llegan a cada etapa. */
export async function getPipelineFunnel(client: SupabaseClient): Promise<PipelineFunnel> {
  const { data, error } = await client.rpc("get_pipeline_funnel");
  if (error) throw new Error(`Error calculando embudo del pipeline: ${error.message}`);
  return data as PipelineFunnel;
}

export interface PipelineScopeTotal {
  count: number;
  totalCapacityMw: number;
}

export interface PipelineScopeTotals {
  esperados: PipelineScopeTotal;
  historico: PipelineScopeTotal;
}

/**
 * Total real (count + MW) por pestaña del Pipeline — agregado en SQL porque
 * "Histórico" puede superar las 1000 filas que PostgREST deja traer sin
 * paginar. Replica los mismos criterios que ya usa listProjects.
 */
export async function getPipelineScopeTotals(client: SupabaseClient): Promise<PipelineScopeTotals> {
  const { data, error } = await client.rpc("get_pipeline_scope_totals");
  if (error) throw new Error(`Error calculando totales del pipeline: ${error.message}`);
  const raw = data as { esperados: { count: number; totalCapacityMw: number }; historico: { count: number; totalCapacityMw: number } };
  return raw;
}

export interface AgeBenchmarkRow {
  label: string;
  avgAgeMonths: number;
  count: number;
}

export interface RequestAgeBenchmarks {
  byTechnology: AgeBenchmarkRow[];
  byRegion: AgeBenchmarkRow[];
  byPmgdUtility: AgeBenchmarkRow[];
  bySizeBucket: AgeBenchmarkRow[];
}

/**
 * Antigüedad real de las solicitudes vigentes (tiempo desde el ingreso real
 * ante el Coordinador hasta hoy, ver project_event event_type='announced') —
 * NO es tiempo de tramitación completo (no tenemos fecha de cada transición
 * de estado, solo el estado actual). Se etiqueta así en la UI a propósito.
 */
export async function getRequestAgeBenchmarks(client: SupabaseClient): Promise<RequestAgeBenchmarks> {
  const { data, error } = await client.rpc("get_request_age_benchmarks");
  if (error) throw new Error(`Error calculando antigüedad de solicitudes: ${error.message}`);
  const raw = data as {
    byTechnology: Array<{ technology: string; avg_age_months: number; count: number }>;
    byRegion: Array<{ region: string; avg_age_months: number; count: number }>;
    byPmgdUtility: Array<{ category: string; avg_age_months: number; count: number }>;
    bySizeBucket: Array<{ bucket: string; avg_age_months: number; count: number }>;
  };
  const map = (rows: Array<{ avg_age_months: number; count: number } & Record<string, unknown>>, key: string): AgeBenchmarkRow[] =>
    rows.map((r) => ({ label: String(r[key]), avgAgeMonths: r.avg_age_months, count: r.count }));
  return {
    byTechnology: map(raw.byTechnology, "technology"),
    byRegion: map(raw.byRegion, "region"),
    byPmgdUtility: map(raw.byPmgdUtility, "category"),
    bySizeBucket: map(raw.bySizeBucket, "bucket"),
  };
}

export interface ScheduleForecastInput {
  id: string;
  name: string;
  status: string | null;
  region: string | null;
  technologyCode: string | null;
  includesStorage: boolean;
  capacityMw: number | null;
  estimatedConnectionDate: string | null;
  verifiedAt: string | null;
}

/**
 * Insumos de todo el pipeline vigente (no paginado — bajo el tope de 1000
 * filas de PostgREST, hoy ~750) para recalcular en Node el modelo
 * probabilístico de cronograma por proyecto (computeEstimatedPhase) y
 * agregarlo — usado por los calendarios de hitos, la demanda de equipos, el
 * embudo de madurez y el Market Snapshot del dashboard. Trae id/status/región
 * porque el dashboard además necesita cruzar con SEIA (Pipeline Health) y
 * agregar por región, no solo por mes.
 */
export async function getUpcomingScheduleInputs(client: SupabaseClient): Promise<ScheduleForecastInput[]> {
  const { data, error } = await client
    .from("project")
    .select(
      "id, name, status, capacity_mw, includes_storage, estimated_connection_date, verified_at, technology:technology_id(code), location:location_id(region:region_id(name))",
    )
    .gte("estimated_connection_date", startOfCurrentMonthIso())
    .not("status", "in", `(${REJECTED_STATUSES.join(",")})`)
    .limit(1000);
  if (error) throw new Error(`Error obteniendo insumos de cronograma del pipeline: ${error.message}`);

  return ((data ?? []) as unknown as Array<{
    id: string;
    name: string;
    status: string | null;
    capacity_mw: number | null;
    includes_storage: boolean;
    estimated_connection_date: string | null;
    verified_at: string | null;
    technology: { code: string } | null;
    location: { region: { name: string } | null } | null;
  }>).map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    region: r.location?.region?.name ?? null,
    technologyCode: r.technology?.code ?? null,
    includesStorage: r.includes_storage,
    capacityMw: r.capacity_mw,
    estimatedConnectionDate: r.estimated_connection_date,
    verifiedAt: r.verified_at,
  }));
}

/**
 * Solicitudes ingresadas realmente en los últimos N días (project_event
 * event_type='announced', fecha real de recepción del Coordinador) — el único
 * "delta" de Market Pulse que podemos calcular hoy sin fabricar: no tenemos
 * fecha de cambio de estado, así que "+X RCA"/"+X MW conectados"/"+X
 * desistidas" en una ventana de tiempo no son calculables todavía (ver
 * getRequestAgeBenchmarks). join con project usa !inner para heredar la
 * política RLS de project (oculta Consumo/Transmisión).
 */
export async function getRecentSolicitudesCount(client: SupabaseClient, days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await client
    .from("project_event")
    .select("id, project:project_id!inner(id)", { count: "exact", head: true })
    .eq("event_type", "announced")
    .gte("occurred_at", cutoff);
  if (error) throw new Error(`Error contando solicitudes recientes: ${error.message}`);
  return count ?? 0;
}

/**
 * Estado SEIA de los proyectos del pipeline vigente, para el cálculo agregado
 * de Pipeline Health — se filtra vía el embed `project:project_id!inner(...)`
 * en vez de un `.in(projectIds)` con ~750 UUIDs (arriesgaría una URL
 * demasiado larga); aplica exactamente los mismos filtros que
 * getUpcomingScheduleInputs para que ambos conjuntos coincidan.
 */
export async function getSeiaStatusesForUpcomingProjects(client: SupabaseClient): Promise<Map<string, string | null>> {
  const { data, error } = await client
    .from("seia_record")
    .select("project_id, status, project:project_id!inner(id, estimated_connection_date, status)")
    .gte("project.estimated_connection_date", startOfCurrentMonthIso())
    .not("project.status", "in", `(${REJECTED_STATUSES.join(",")})`);
  if (error) throw new Error(`Error obteniendo estados SEIA del pipeline vigente: ${error.message}`);

  const map = new Map<string, string | null>();
  for (const row of (data ?? []) as unknown as Array<{ project_id: string; status: string | null }>) {
    map.set(row.project_id, row.status);
  }
  return map;
}

export interface ConnectionCalendarEntry {
  yearMonth: string; // "YYYY-MM"
  count: number;
  capacityMw: number;
}

/** Proyectos con fecha estimada de conexión en los próximos N meses, agrupados por mes. */
export async function getConnectionCalendar(client: SupabaseClient, monthsAhead = 24): Promise<ConnectionCalendarEntry[]> {
  const { data, error } = await client.rpc("get_connection_calendar", { months_ahead: monthsAhead });
  if (error) throw new Error(`Error calculando calendario de conexiones: ${error.message}`);
  return (data ?? []).map((r: { year_month: string; count: number; capacity_mw: number }) => ({
    yearMonth: r.year_month,
    count: r.count,
    capacityMw: r.capacity_mw,
  }));
}
