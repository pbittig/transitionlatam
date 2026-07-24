import Link from "next/link";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { getProjectsForMap, getRecentProjectEvents, listProjects } from "@/lib/data-access/projects";
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
import { PHASE_COLORS } from "@/lib/shared/projectPhaseDurations";
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
import { TechChipFilter } from "../components/TechChipFilter";
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
import { Activity, ArrowUpRight, BatteryCharging, FolderKanban, Radar } from "lucide-react";

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
  searchParams: Promise<{ tech?: string; page?: string; tab?: string; q?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1") || 1;
  const tab = params.tab === "historico" ? "historico" : "esperados";
  const selectedKeys = parseChipKeys(params.tech);
  const technologyCodes = chipsToTechnologyCodes(selectedKeys);
  const namePatterns = chipsToNamePatterns(selectedKeys);
  const search = params.q;

  const client = await createSupabaseServerClient();

  const filters = {
    technologyCodes,
    namePatterns,
    search,
    connectionPeriod: (tab === "historico" ? "historico_completo" : "upcoming") as "historico_completo" | "upcoming",
  };

  const [
    result,
    mapData,
    funnel,
    calendar,
    scheduleInputs,
    scopeTotals,
    seiaStatusByProjectId,
    ageBenchmarks,
    solicitudes7d,
    solicitudes30d,
    recentEvents,
    admin,
  ] = await Promise.all([
    listProjects(client, filters, page, PAGE_SIZE),
    getProjectsForMap(client, { technologyCodes, namePatterns, search }),
    getPipelineFunnel(client),
    getConnectionCalendar(client),
    getUpcomingScheduleInputs(client),
    getPipelineScopeTotals(client),
    getSeiaStatusesForUpcomingProjects(client),
    getRequestAgeBenchmarks(client),
    getRecentSolicitudesCount(client, 7),
    getRecentSolicitudesCount(client, 30),
    getRecentProjectEvents(client, 10),
    isAdmin(),
  ]);
  const scopeTotal = scopeTotals[tab];
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));
  const seiaByProjectId = await getSeiaRecordsForProjects(
    client,
    result.items.map((p) => p.id),
  );
  const crmProjectIds = admin
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
  const bess = pipelineByTechnology.find((item) => /bess|almacenamiento/i.test(item.category));
  const activeFilterLabels = [
    ...TECH_CHIPS.filter((chip) => selectedKeys.includes(chip.key)).map((chip) => chip.label),
    search ? `“${search}”` : undefined,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-8">
      <section className="border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
          <Radar size={14} className="text-brand-primary" /> PROYECTOS FUTUROS · CHILE
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl dark:text-neutral-50">Pipeline de conexión</h1>
            <p className="mt-2 max-w-2xl text-neutral-600 dark:text-neutral-400">
              Proyectos en desarrollo, sus señales regulatorias y la ruta hacia su conexión. Fuente: Acceso Abierto. Distinto de{" "}
              <Link href="/mercado" className="underline underline-offset-2">Mercado</Link> (centrales ya operativas).
            </p>
          </div>
          <a href="#lista-proyectos" className="inline-flex items-center gap-1 text-sm font-medium text-neutral-700 hover:text-brand-primary dark:text-neutral-300">
            Explorar cartera <ArrowUpRight size={16} />
          </a>
        </div>
      </section>

      <div className="grid gap-px overflow-hidden rounded-xl border border-neutral-200 bg-neutral-200 sm:grid-cols-3 dark:border-neutral-800 dark:bg-neutral-800">
        <div className="bg-white p-4 dark:bg-neutral-900">
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400"><FolderKanban size={15} /> Cobertura actual</div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">{result.totalCount.toLocaleString("es-CL")}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">solicitudes en esta vista</p>
        </div>
        <div className="bg-white p-4 dark:bg-neutral-900">
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400"><Activity size={15} /> Potencia a monitorear</div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">{(filteredCapacityMw / 1000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} GW</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">de los proyectos con el filtro activo</p>
        </div>
        <div className="bg-white p-4 dark:bg-neutral-900">
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400"><BatteryCharging size={15} /> Almacenamiento BESS</div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">{bess?.count.toLocaleString("es-CL") ?? "—"}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">proyectos BESS dentro del pipeline</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
        {TABS.map((t) => {
          const active = t.key === tab;
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
        <Panel className="flex flex-col gap-5 border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Filtra la cartera</h3><p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Combina tecnologías y búsqueda para encontrar el proyecto u oportunidad relevante.</p></div>{(hasTechFilter || search) && <Link href={buildHref(params, { tech: undefined, q: undefined, page: undefined })} className="text-sm font-medium text-neutral-600 underline underline-offset-2 hover:text-brand-primary dark:text-neutral-300">Restablecer filtros</Link>}</div>
        <SearchBar
          basePath="/proyectos-esperados"
          value={search}
          otherParams={{ tab: tab === "esperados" ? undefined : tab, tech: params.tech }}
          placeholder="Buscar por nombre de proyecto..."
        />
        <TechChipFilter
          basePath="/proyectos-esperados"
          selectedKeys={selectedKeys}
          otherParams={{ tab: tab === "esperados" ? undefined : tab, q: search }}
          excludeKeys={["transmision"]}
        />
        {activeFilterLabels.length > 0 ? <p className="border-t border-neutral-200 pt-3 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-300"><span className="font-medium">Vista actual:</span> {activeFilterLabels.join(" · ")}</p> : <p className="border-t border-neutral-200 pt-3 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">Los filtros también acotan el análisis de madurez, hitos y demanda futura.</p>}
        </Panel>
      </section>

      <Panel className="flex flex-col gap-4">
        <div>
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
        <ProjectTable items={result.items} seiaByProjectId={seiaByProjectId} admin={admin} crmProjectIds={crmProjectIds} />
        <Pager page={page} totalPages={totalPages} buildHref={(p) => buildHref(params, { page: String(p) })} />
      </Panel>

      <AnalysisDrawer title="Análisis del pipeline" description="Profundiza en madurez, fechas de conexión, demanda de equipos y salud de la cartera.">
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
              qué macro-etapa real de desarrollo estimamos que está cada solicitud vigente (mismo modelo que "Estado
              del Proyecto" en cada ficha). Respeta el filtro de tecnología de arriba.
              {maturityFunnel.skipped > 0
                ? ` ${maturityFunnel.skipped} solicitudes vigentes quedaron fuera por no tener tecnología clasificada.`
                : ""}
            </p>
          </div>
          <MaturityFunnelChart funnel={maturityFunnel} />
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
          <ConnectionCalendarChart entries={calendar} />
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
