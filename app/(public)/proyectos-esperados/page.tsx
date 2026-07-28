import Link from "next/link";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { getProjectsForMap, getRecentlyAnnouncedProjects, getRecentProjectEvents, getVigenteVerificationProgress, listProjects } from "@/lib/data-access/projects";
import { getSeiaRecordsForProjects } from "@/lib/data-access/seia";
import { isAdmin } from "@/lib/auth/session";
import { getActiveOpportunityProjectIds } from "@/lib/data-access/crmOpportunities";
import {
  getConnectionCalendar,
  getPipelineFunnel,
  getPipelineScopeTotals,
  getRecentSolicitudesCount,
  getRequestAgeBenchmarks,
  getSeiaStatusesForUpcomingProjects,
  getUpcomingScheduleInputs,
} from "@/lib/data-access/pipeline";
import { computeScheduleForecast, FORECAST_PHASE_LABELS } from "@/lib/shared/scheduleForecast";
import { PHASE_COLORS, PHASE_GROUP_LABELS, PHASE_TO_GROUP, type PhaseGroup } from "@/lib/shared/projectPhaseDurations";
import { computeEstimatedPhase } from "@/lib/shared/computeEstimatedPhase";
import { computeMaturityFunnel } from "@/lib/shared/maturityFunnel";
import {
  computeMarketCalendarHighlights,
  computeMarketNarrative,
  computeMarketSnapshotInsights,
  computePipelineByRegion,
  computePipelineByTechnology,
  computePipelineHealth,
  computePipelineTotals,
  findNextConstructionWaveYear,
} from "@/lib/shared/marketSnapshot";
import { chipsToNamePatterns, chipsToTechnologyCodes, parseChipKeys, TECH_CHIPS } from "../components/techChips";
import { TechSelectFilter } from "../components/TechSelectFilter";
import { ConnectionDateRangeFilter } from "../components/ConnectionDateRangeFilter";
import { MONTHS_HORIZON, monthOffsetToIso } from "@/lib/shared/connectionDateRange";
import { EtapaFilter } from "../components/EtapaFilter";
import { SearchBar } from "../components/SearchBar";
import { ProjectTable } from "../components/ProjectTable";
import { Pager } from "../components/Pager";
import { Panel } from "../components/Panel";
import { MapView } from "../components/MapView";
import { PipelineFunnelChart } from "../components/PipelineFunnelChart";
import { ConnectionCalendarChart } from "../components/ConnectionCalendarChart";
import { PipelineGanttChart } from "../components/PipelineGanttChart";
import { MilestoneCalendarChart } from "../components/MilestoneCalendarChart";
import { EquipmentDemandPanel } from "../components/EquipmentDemandPanel";
import { MaturityFunnelChart } from "../components/MaturityFunnelChart";
import { AnalysisDrawer } from "../components/AnalysisDrawer";
import { MarketSnapshotList } from "../components/MarketSnapshotList";
import { BarList } from "../components/BarList";
import { PipelineHealthBar } from "../components/PipelineHealthBar";
import { MarketPulseCard } from "../components/MarketPulseCard";
import { ActivityTimeline } from "../components/ActivityTimeline";
import { MarketCalendarNarrative } from "../components/MarketCalendarNarrative";
import { AgeBenchmarksPanel } from "../components/AgeBenchmarksPanel";
import { VerificationProgressBar } from "../components/VerificationProgressBar";
import { PlanGate } from "../components/PlanGate";
import { getIsFreeTier } from "@/lib/entitlements/isFreeTier";
import { Activity, ArrowUpRight, BatteryCharging, CalendarClock, FolderKanban, Gauge, MapPin, Radar, Zap } from "lucide-react";

export const metadata: Metadata = { title: "Proyectos Esperados" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const TABS: Array<{ key: "esperados" | "historico"; label: string }> = [
  { key: "esperados", label: "Esperados" },
  { key: "historico", label: "Histórico" },
];

function buildHref(params: Record<string, string | undefined>, overrides: Record<string, string | undefined>): string {
  const merged = { ...params, ...overrides };
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) qs.set(key, value);
  }
  const query = qs.toString();
  return query ? `/proyectos-esperados?${query}` : "/proyectos-esperados";
}

export default async function ProyectosEsperadosPage({
  searchParams,
}: {
  searchParams: Promise<{ tech?: string; page?: string; tab?: string; q?: string; etapa?: string; mesDesde?: string; mesHasta?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1") || 1;
  // "Histórico" deshabilitado temporalmente en el sitio público hasta terminar de
  // verificar ese lote (2026-07-27) — se sigue pudiendo pedir por URL, pero se ignora acá
  // para no exponer datos históricos todavía sin revisar. El tab queda visible pero
  // deshabilitado más abajo, en vez de ocultarlo, para que quede claro que viene después.
  const HISTORICO_HABILITADO = false;
  const tab = HISTORICO_HABILITADO && params.tab === "historico" ? "historico" : "esperados";
  const selectedKeys = parseChipKeys(params.tech);
  const technologyCodes = chipsToTechnologyCodes(selectedKeys);
  const namePatterns = chipsToNamePatterns(selectedKeys);
  const search = params.q;
  const etapaGroup = params.etapa as PhaseGroup | undefined;
  const mesDesde = Number(params.mesDesde ?? "0") || 0;
  const mesHasta = Number(params.mesHasta ?? String(MONTHS_HORIZON)) || MONTHS_HORIZON;
  const hasDateRangeFilter = tab === "esperados" && (mesDesde > 0 || mesHasta < MONTHS_HORIZON);

  const client = await createSupabaseServerClient();

  const filters = {
    technologyCodes,
    namePatterns,
    search,
    connectionPeriod: (tab === "historico" ? "historico_completo" : "upcoming") as "historico_completo" | "upcoming",
    connectionDateFrom: tab === "esperados" && mesDesde > 0 ? monthOffsetToIso(mesDesde) : undefined,
    connectionDateTo: tab === "esperados" && mesHasta < MONTHS_HORIZON ? monthOffsetToIso(mesHasta) : undefined,
    // Mientras se sigue verificando la cartera, el sitio público solo lista fichas ya
    // revisadas a mano — el resto del pipeline se sigue mostrando en las estadísticas
    // agregadas (GW, embudo, mapa), solo la tabla navegable se acota.
    verifiedOnly: true,
  };

  const scheduleInputs = await getUpcomingScheduleInputs(client);

  const etapaProjectIds = etapaGroup && tab === "esperados"
    ? scheduleInputs
        .filter((i) => {
          const phase = computeEstimatedPhase(i.estimatedConnectionDate, i.technologyCode, i.includesStorage, i.capacityMw);
          return phase?.currentPhase != null && PHASE_TO_GROUP[phase.currentPhase] === etapaGroup;
        })
        .map((i) => i.id)
    : undefined;

  const [
    result,
    mapData,
    funnel,
    calendar,
    scopeTotals,
    seiaStatusByProjectId,
    ageBenchmarks,
    solicitudes7d,
    solicitudes30d,
    recentEvents,
    newProjects,
    admin,
    verificationProgress,
  ] = await Promise.all([
    listProjects(client, { ...filters, projectIds: etapaProjectIds }, page, PAGE_SIZE),
    getProjectsForMap(client, { technologyCodes, namePatterns, search }),
    getPipelineFunnel(client),
    getConnectionCalendar(client),
    getPipelineScopeTotals(client),
    getSeiaStatusesForUpcomingProjects(client),
    getRequestAgeBenchmarks(client),
    getRecentSolicitudesCount(client, 7),
    getRecentSolicitudesCount(client, 30),
    getRecentProjectEvents(client, 10),
    getRecentlyAnnouncedProjects(client, 24),
    isAdmin(),
    getVigenteVerificationProgress(client),
  ]);
  const isFree = !admin && (await getIsFreeTier(client));
  const scopeTotal = scopeTotals[tab];
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));
  const seiaByProjectId = await getSeiaRecordsForProjects(
    client,
    result.items.map((p) => p.id),
  );
  const crmProjectIds = admin || !isFree
    ? await getActiveOpportunityProjectIds(createSupabaseServiceClient(), result.items.map((p) => p.id))
    : new Set<string>();

  // Los mismos chips de tecnología que ya filtran la tabla/mapa de arriba
  // también acotan el embudo de madurez, el calendario de hitos y la demanda
  // de equipos — así el usuario puede seleccionar "Solar" o "BESS" y ver
  // cuántos MW se esperan solo para esa tecnología, sin un control aparte.
  const hasTechFilter = technologyCodes.length > 0 || namePatterns.length > 0;
  const filteredScheduleInputs = hasTechFilter
    ? scheduleInputs.filter(
        (i) =>
          (i.technologyCode && technologyCodes.includes(i.technologyCode)) ||
          namePatterns.some((p) => i.name.toLowerCase().includes(p.toLowerCase())),
      )
    : scheduleInputs;

  const forecast = computeScheduleForecast(filteredScheduleInputs);
  const maturityFunnel = computeMaturityFunnel(filteredScheduleInputs);

  const pipelineTotals = computePipelineTotals(filteredScheduleInputs);
  const pipelineByTechnology = computePipelineByTechnology(filteredScheduleInputs);
  const pipelineByRegion = computePipelineByRegion(filteredScheduleInputs);
  const pipelineHealth = computePipelineHealth(filteredScheduleInputs, seiaStatusByProjectId);
  const nextWaveYear = findNextConstructionWaveYear(forecast.milestoneCalendars.find((mc) => mc.phase === "construccion"));
  const calendarHighlights = computeMarketCalendarHighlights(forecast.milestoneCalendars, calendar);

  const marketSnapshot = computeMarketSnapshotInsights({
    pipelineTotals,
    byTechnology: pipelineByTechnology,
    byRegion: pipelineByRegion,
    ageBenchmarks,
    constructionTotalMw: 0, // el dato de construcción vive en /mercado, no se repite acá
    recentSolicitudes7d: solicitudes7d,
  });
  const marketNarrative = computeMarketNarrative({ byTechnology: pipelineByTechnology, byRegion: pipelineByRegion, nextWaveYear });
  const filteredCapacityMw = filteredScheduleInputs.reduce((sum, project) => sum + (project.capacityMw ?? 0), 0);
  // No usar pipelineByTechnology acá: esa agrupación clasifica cada proyecto por una
  // sola tecnología canónica (para poder cruzar Pipeline/Construcción/Operación en un
  // mismo heatmap — ver marketTechCategories.ts), así que un híbrido "Solar con
  // Baterías" cae en "Híbrido", no en "BESS", y este contador quedaba muy por debajo
  // de lo que el buscador encuentra por nombre. includesStorage sí marca cualquier
  // proyecto con batería sin importar su tecnología principal.
  const bessCount = filteredScheduleInputs.filter((i) => i.includesStorage).length;
  const activeFilterLabels = [
    ...TECH_CHIPS.filter((chip) => selectedKeys.includes(chip.key)).map((chip) => chip.label),
    search ? `“${search}”` : undefined,
    etapaGroup ? PHASE_GROUP_LABELS[etapaGroup] : undefined,
    hasDateRangeFilter ? "rango de fecha de conexión" : undefined,
  ].filter(Boolean);
  const topTechnology = pipelineByTechnology[0];
  const topRegion = pipelineByRegion[0];
  const topTechnologyShare = topTechnology && pipelineTotals.totalCapacityMw > 0
    ? (topTechnology.capacityMw / pipelineTotals.totalCapacityMw) * 100
    : 0;
  const topRegionShare = topRegion && pipelineTotals.totalCapacityMw > 0
    ? (topRegion.capacityMw / pipelineTotals.totalCapacityMw) * 100
    : 0;
  const executiveSignals = [
    {
      icon: Zap,
      label: "Tecnología dominante",
      title: topTechnology?.category ?? "Sin tecnología dominante",
      value: topTechnology ? `${topTechnologyShare.toLocaleString("es-CL", { maximumFractionDigits: 0 })}% de los MW del pipeline` : "Sin datos suficientes",
      guidance: "Ayuda a dimensionar dónde se concentra la competencia y qué tipo de soluciones tendrá mayor demanda.",
      color: "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10",
    },
    {
      icon: MapPin,
      label: "Concentración regional",
      title: topRegion?.region ?? "Sin región dominante",
      value: topRegion ? `${topRegionShare.toLocaleString("es-CL", { maximumFractionDigits: 0 })}% de la capacidad futura` : "Sin datos suficientes",
      guidance: "Úsalo para priorizar estudios territoriales, puntos de conexión y actividad comercial por región.",
      color: "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/10",
    },
    {
      icon: Gauge,
      label: "Salud de la cartera",
      title: `${pipelineHealth.bajaPct}% con riesgo alto`,
      value: `${pipelineHealth.altaPct}% en desarrollo normal`,
      guidance: "Permite separar volumen anunciado de proyectos con mejores señales de avance y cumplimiento de fecha.",
      color: "text-brand-deep bg-brand-surface dark:text-brand-primary dark:bg-brand-primary/10",
    },
  ];

  return (
    <div className="flex flex-col gap-10">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-ink via-brand-deep to-[#1b8d83] px-6 py-8 text-white shadow-xl shadow-brand-deep/10 md:px-8 md:py-10">
        <span className="absolute -top-20 right-10 h-52 w-52 rounded-full border border-white/10" aria-hidden />
        <span className="absolute -right-10 -bottom-24 h-64 w-64 rounded-full bg-brand-primary/15 blur-2xl" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium tracking-[0.14em] text-brand-primary uppercase">
              <Radar size={14} /> Proyectos futuros · Chile
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Pipeline de conexión</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75 md:text-base">
              Proyectos en desarrollo, sus señales regulatorias y la ruta hacia su conexión. Fuente: Acceso Abierto. Distinto de{" "}
              <Link href="/mercado" className="font-medium text-white underline underline-offset-2">Infraestructura</Link> (centrales ya operativas).
            </p>
          </div>
          <a href="#lista-proyectos" className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15">
            Explorar cartera <ArrowUpRight size={16} />
          </a>
        </div>
      </section>

      <section aria-labelledby="pipeline-summary-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-brand-deep uppercase dark:text-brand-primary">Foto de la cartera</p>
            <h2 id="pipeline-summary-title" className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">Magnitud, composición y actividad reciente</h2>
          </div>
          <p className="max-w-md text-sm text-neutral-500 dark:text-neutral-400">Los indicadores respetan el filtro tecnológico cuando corresponde.</p>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: FolderKanban, label: "Proyectos monitoreados", value: pipelineTotals.count.toLocaleString("es-CL"), detail: "solicitudes vigentes con cronograma", accent: "border-t-brand-primary", iconClass: "bg-brand-surface text-brand-deep dark:bg-brand-primary/10 dark:text-brand-primary" },
            { icon: Activity, label: "Capacidad futura", value: `${(filteredCapacityMw / 1000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} GW`, detail: "con el filtro tecnológico activo", accent: "border-t-data-blue", iconClass: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" },
            { icon: BatteryCharging, label: "Proyectos con BESS", value: bessCount.toLocaleString("es-CL"), detail: "incluyen almacenamiento en baterías", accent: "border-t-data-bess", iconClass: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300" },
            { icon: CalendarClock, label: "Actividad reciente", value: `+${solicitudes30d.toLocaleString("es-CL")}`, detail: "solicitudes ingresadas en 30 días", accent: "border-t-data-solar", iconClass: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" },
          ].map(({ icon: Icon, label, value, detail, accent, iconClass }) => (
            <article key={label} className={`rounded-2xl border border-neutral-200 border-t-2 ${accent} bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950`}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{label}</p>
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconClass}`}><Icon size={15} /></span>
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">{value}</p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-brand-primary/25 bg-gradient-to-br from-brand-surface via-white to-white p-6 dark:via-neutral-950 dark:to-neutral-950" aria-labelledby="pipeline-reading-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-brand-deep uppercase dark:text-brand-primary">Lectura ejecutiva</p>
            <h2 id="pipeline-reading-title" className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">Dónde se concentra la oportunidad y qué vigilar</h2>
          </div>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Estimaciones propias basadas en señales regulatorias y fechas disponibles</span>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {executiveSignals.map(({ icon: Icon, label, title, value, guidance, color }) => (
            <article key={label} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center gap-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${color}`}><Icon size={17} /></span>
                <p className="text-[10px] font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">{label}</p>
              </div>
              <h3 className="mt-4 text-base font-semibold text-neutral-950 dark:text-white">{title}</h3>
              <p className="mt-1 text-sm font-medium text-brand-deep dark:text-brand-primary">{value}</p>
              <p className="mt-3 border-t border-neutral-100 pt-3 text-xs leading-5 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400"><span className="font-semibold text-neutral-700 dark:text-neutral-300">Cómo usarlo:</span> {guidance}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="flex gap-1 rounded-xl border border-neutral-200 bg-white px-2 pt-1 dark:border-neutral-800 dark:bg-neutral-950">
        {TABS.map((t) => {
          const active = t.key === tab;
          if (t.key === "historico" && !HISTORICO_HABILITADO) {
            return (
              <span
                key={t.key}
                title="Disponible cuando termine la revisión de esta sección"
                className="-mb-px cursor-not-allowed border-b-2 border-transparent px-3 py-2 text-sm font-medium text-neutral-300 dark:text-neutral-700"
              >
                {t.label} <span className="text-xs">(próximamente)</span>
              </span>
            );
          }
          return (
            <Link
              key={t.key}
              href={buildHref(params, { tab: t.key === "esperados" ? undefined : t.key, page: undefined })}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                active
                  ? "border-neutral-900 text-neutral-900 dark:border-neutral-50 dark:text-neutral-50"
                  : "border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      {tab === "esperados" && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Desde el día 1 de este mes en adelante, ordenados por fecha de conexión más próxima.
        </p>
      )}
      {tab === "historico" && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Todo lo que ya pasó de fecha, más lo rechazado o desistido, sin importar la fecha.
        </p>
      )}

      <section id="lista-proyectos" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">Explorador de proyectos</p><h2 className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-50">Cartera de conexión</h2></div>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">{result.totalCount.toLocaleString("es-CL")} solicitudes en la vista</span>
        </div>
        <Panel className="flex flex-col gap-5 border-brand-primary/20 bg-white p-5 shadow-sm dark:border-brand-primary/15 dark:bg-neutral-950">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Filtra la cartera</h3><p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Combina tecnologías y búsqueda para encontrar el proyecto u oportunidad relevante.</p></div>{(hasTechFilter || search || Boolean(etapaGroup) || hasDateRangeFilter) && <Link href={buildHref(params, { tech: undefined, q: undefined, etapa: undefined, mesDesde: undefined, mesHasta: undefined, page: undefined })} className="text-sm font-medium text-neutral-600 underline underline-offset-2 hover:text-brand-primary dark:text-neutral-300">Restablecer filtros</Link>}</div>
        <SearchBar
          basePath="/proyectos-esperados"
          value={search}
          otherParams={{ tab: tab === "esperados" ? undefined : tab, tech: params.tech }}
          placeholder="Buscar por nombre de proyecto..."
        />
        <TechSelectFilter basePath="/proyectos-esperados" selectedKeys={selectedKeys} excludeKeys={["transmision"]} />
        {tab === "esperados" && <EtapaFilter basePath="/proyectos-esperados" />}
        {tab === "esperados" && <ConnectionDateRangeFilter basePath="/proyectos-esperados" />}
        {activeFilterLabels.length > 0 ? <p className="border-t border-neutral-200 pt-3 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-300"><span className="font-medium">Vista actual:</span> {activeFilterLabels.join(" · ")}</p> : <p className="border-t border-neutral-200 pt-3 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">Los filtros también acotan el análisis de madurez, hitos y demanda futura.</p>}
        </Panel>
      </section>

      <Panel className="flex flex-col gap-4 overflow-hidden p-0">
        <div className="px-5 pt-5">
        {tab === "esperados" && <VerificationProgressBar progress={verificationProgress} />}
        <div className="mt-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {result.totalCount.toLocaleString("es-CL")} solicitudes de conexión{hasTechFilter || search ? " con este filtro" : ""}
            {" · "}
            {(scopeTotal.totalCapacityMw / 1000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} GW en total en esta
            pestaña{hasTechFilter || search ? " (MW sin aplicar el filtro de tecnología/búsqueda)" : ""}.
          </p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            La barra de <strong>estado del proceso</strong> muestra qué tan avanzada está la solicitud dentro del
            trámite de conexión chileno; la de <strong>estado ambiental</strong> es el mismo concepto pero para el
            trámite ante el SEA (Servicio de Evaluación Ambiental) — solo aparece cuando encontramos un expediente
            SEIA que coincide con el proyecto. Ambas son estimaciones nuestras del orden típico del proceso, no un
            dato oficial verificado.
          </p>
        </div>
        </div>
        <div className="border-t border-neutral-100 dark:border-neutral-800"><ProjectTable items={result.items} seiaByProjectId={seiaByProjectId} crmProjectIds={crmProjectIds} isFree={isFree} /></div>
        <div className="px-5 pb-5"><Pager page={page} totalPages={totalPages} buildHref={(p) => buildHref(params, { page: String(p) })} /></div>
      </Panel>

      <AnalysisDrawer title="Análisis detallado de proyectos futuros" description="Profundiza en madurez, fechas de conexión, demanda de equipos y salud de la cartera.">
        <div className="rounded-2xl border border-brand-primary/25 bg-brand-surface p-5 dark:bg-brand-primary/10">
          <p className="text-xs font-semibold tracking-wide text-brand-deep uppercase dark:text-brand-primary">Cómo leer este análisis</p>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">Comienza por el panorama actual y la salud de la cartera; después revisa regiones y antigüedad; finalmente usa los calendarios y la demanda de equipos para identificar ventanas comerciales.</p>
        </div>
        <Panel className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-widest text-neutral-500 uppercase dark:text-neutral-400">
              Mercado hoy
            </h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Respeta el filtro de tecnología de arriba.</p>
          </div>
          <MarketSnapshotList insights={marketSnapshot} />
          {marketNarrative && (
            <p className="border-l-2 border-neutral-900 pl-4 text-sm text-neutral-700 italic dark:border-neutral-50 dark:text-neutral-300">
              {marketNarrative}
            </p>
          )}
        </Panel>

        <Panel className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-widest text-neutral-500 uppercase dark:text-neutral-400">
              ¿Dónde está creciendo?
            </h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Pipeline vigente por región (MW), top 8. Respeta el filtro de tecnología de arriba.
            </p>
          </div>
          <BarList
            items={pipelineByRegion
              .slice(0, 8)
              .map((r) => ({ label: r.region, value: Math.round(r.capacityMw), secondaryValue: `${r.count} proyectos` }))}
          />
        </Panel>

        <Panel className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-widest text-neutral-500 uppercase dark:text-neutral-400">
              Pipeline Health
            </h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Respeta el filtro de tecnología de arriba.</p>
          </div>
          <PipelineHealthBar health={pipelineHealth} />
        </Panel>

        <Panel className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold tracking-widest text-neutral-500 uppercase dark:text-neutral-400">
            Market Pulse
          </h2>
          <MarketPulseCard solicitudes7d={solicitudes7d} solicitudes30d={solicitudes30d} />
        </Panel>

        <Panel className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold tracking-widest text-neutral-500 uppercase dark:text-neutral-400">
            Actividad reciente
          </h2>
          <ActivityTimeline events={recentEvents} />
        </Panel>

        <Panel className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-widest text-neutral-500 uppercase dark:text-neutral-400">
              Proyectos nuevos (últimas 24h)
            </h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Solicitudes que entraron a Acceso Abierto en las últimas 24 horas.
            </p>
          </div>
          <ActivityTimeline events={newProjects} />
        </Panel>

        <Panel className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-widest text-neutral-500 uppercase dark:text-neutral-400">
              Calendario del mercado
            </h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Trimestres de mayor actividad estimada — Compras, Construcción y Conexión, sobre el pipeline vigente.
            </p>
          </div>
          <MarketCalendarNarrative highlights={calendarHighlights} />
        </Panel>

        <Panel className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-widest text-neutral-500 uppercase dark:text-neutral-400">
              Antigüedad de la cartera
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-neutral-500 dark:text-neutral-400">
              Tiempo transcurrido desde el ingreso real de la solicitud ante el Coordinador hasta hoy, para
              solicitudes vigentes. <strong>No es tiempo de tramitación completo</strong> — todavía no registramos la
              fecha de cada cambio de estado, solo el estado actual y la fecha de ingreso. Categorías con menos de 5
              solicitudes se omiten.
            </p>
          </div>
          <AgeBenchmarksPanel benchmarks={ageBenchmarks} />
        </Panel>

        <Panel className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-widest text-neutral-500 uppercase dark:text-neutral-400">Alertas</h2>
          {admin ? (
            <>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Sigue proyectos desde su ficha y revisa sus novedades en un solo lugar.
              </p>
              <Link
                href="/alertas"
                className="w-fit rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-50 dark:text-neutral-900"
              >
                Ir a Alertas
              </Link>
            </>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Inicia sesión como administrador para seguir proyectos y ver sus novedades.
            </p>
          )}
        </Panel>

        <Panel className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-widest text-neutral-500 uppercase dark:text-neutral-400">
              Embudo del pipeline
            </h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Cuántas de todas las solicitudes históricas llegan a cada etapa del proceso, sin filtros de tecnología
              ni búsqueda.
            </p>
          </div>
          <PipelineFunnelChart funnel={funnel} />
        </Panel>

        <Panel className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-widest text-neutral-500 uppercase dark:text-neutral-400">
              Embudo de madurez (inferido)
            </h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Distinto del embudo de arriba: ese mide avance <strong>administrativo</strong> (SAC/SEIA); este mide en
              qué macro-etapa real de desarrollo estimamos que está cada solicitud vigente (el mismo modelo llamado{" "}
              <strong>Estado del proyecto</strong> en cada ficha). Respeta el filtro de tecnología de arriba.
              {maturityFunnel.skipped > 0
                ? ` ${maturityFunnel.skipped} solicitudes vigentes quedaron fuera por no tener tecnología clasificada.`
                : ""}
            </p>
          </div>
          <PlanGate locked={isFree}>
            <MaturityFunnelChart funnel={maturityFunnel} />
          </PlanGate>
        </Panel>

        <Panel className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-widest text-neutral-500 uppercase dark:text-neutral-400">
              Calendario de conexiones
            </h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              MW con fecha estimada de conexión por mes, próximos 24 meses (excluye rechazadas y desistidas).
            </p>
          </div>
          <PlanGate locked={isFree}>
            <ConnectionCalendarChart entries={calendar} />
          </PlanGate>
        </Panel>

        <Panel className="flex flex-col gap-6">
          <div>
            <h2 className="text-sm font-semibold tracking-widest text-neutral-500 uppercase dark:text-neutral-400">
              Calendario de hitos previos
            </h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              A diferencia del calendario de conexiones (fecha oficial), estos son hitos estimados por el modelo
              probabilístico de cronograma — cuándo entrarían en Ingeniería Básica, Compras o Construcción, en MW.
              Respeta el filtro de tecnología de arriba.
              {forecast.skipped > 0
                ? ` ${forecast.skipped} proyectos del pipeline vigente quedaron fuera por no tener tecnología clasificada.`
                : ""}
            </p>
          </div>
          {forecast.milestoneCalendars.map(({ phase, entries }) => (
            <div key={phase}>
              <h3 className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {FORECAST_PHASE_LABELS[phase]}
              </h3>
              <MilestoneCalendarChart entries={entries} color={PHASE_COLORS[phase]} />
            </div>
          ))}
        </Panel>

        <Panel className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-widest text-neutral-500 uppercase dark:text-neutral-400">
              Demanda futura de equipos
            </h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              MW del pipeline vigente entrando a etapa de Compras, por año y tipo de proyecto. Respeta el filtro de
              tecnología de arriba.
            </p>
          </div>
          <EquipmentDemandPanel entries={forecast.equipmentDemand} />
        </Panel>

        <Panel className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-widest text-neutral-500 uppercase dark:text-neutral-400">
              Gantt agregado
            </h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Cronograma probabilístico de los {result.items.length} proyectos de esta página (mismo filtro y página
              que la tabla de arriba), en un eje de fechas compartido.
            </p>
          </div>
          <PipelineGanttChart items={result.items} />
        </Panel>

        <Panel className="flex flex-col gap-4">
          <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-50">Mapa del pipeline</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {mapData.precisePoints.length.toLocaleString("es-CL")} con ubicación exacta, resto agregado por región
            (respeta los filtros de tecnología de arriba).
          </p>
          <MapView regionBubbles={mapData.regionBubbles} precisePoints={mapData.precisePoints} />
        </Panel>

        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          Cuando el Coordinador publique una segunda versión del listado, empezaremos a registrar cambios de estado
          con fecha real (hoy solo tenemos un snapshot) — eso permitirá calcular tiempo de tramitación completo por
          etapa, no solo antigüedad. También evaluamos incorporar permisos sectoriales (PAS) asociados al SEIA para
          estimar mejor el riesgo de atraso.
        </p>
      </AnalysisDrawer>
    </div>
  );
}
