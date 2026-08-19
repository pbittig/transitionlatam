import Link from "next/link";
import type { Metadata } from "next";
import { Filter, MapPinned } from "lucide-react";
import { createSupabasePageClient } from "@/lib/data-access/supabase-page-client";
import { getProjectsForMap, listProjects } from "@/lib/data-access/projects";
import { getSeiaRecordsForProjects } from "@/lib/data-access/seia";
import { getLatestPgpProgressForProjects } from "@/lib/data-access/pgpProgress";
import { isAdmin } from "@/lib/auth/session";
import {
  getConnectionCalendar,
  getPipelineFunnel,
  getRecentSolicitudesCount,
  getRequestAgeBenchmarks,
  getSeiaStatusesForUpcomingProjects,
  getUpcomingScheduleInputs,
} from "@/lib/data-access/pipeline";
import { computeScheduleForecast, FORECAST_PHASE_LABELS } from "@/lib/shared/scheduleForecast";
import { PHASE_COLORS, PHASE_GROUP_LABELS, PHASE_TO_GROUP, type PhaseGroup } from "@/lib/shared/projectPhaseDurations";
import { computeEstimatedPhase } from "@/lib/shared/computeEstimatedPhase";
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
import { MONTHS_HORIZON, monthOffsetToIso } from "@/lib/shared/connectionDateRange";
import { EtapaFilter } from "../components/EtapaFilter";
import { SearchBar } from "../components/SearchBar";
import { ProjectTable } from "../components/ProjectTable";
import { Pager } from "../components/Pager";
import { Panel } from "../components/Panel";
import { MapView } from "../components/MapView";
import { PipelineFunnelChart } from "../components/PipelineFunnelChart";
import { ConnectionCalendarChart } from "../components/ConnectionCalendarChart";
import { MilestoneCalendarChart } from "../components/MilestoneCalendarChart";
import { EquipmentDemandPanel } from "../components/EquipmentDemandPanel";
import { AnalysisDrawer } from "../components/AnalysisDrawer";
import { MarketSnapshotList } from "../components/MarketSnapshotList";
import { PipelineHealthBar } from "../components/PipelineHealthBar";
import { MarketCalendarNarrative } from "../components/MarketCalendarNarrative";
import { ModuleGuide } from "../components/ModuleGuide";
import { PlanGate } from "../components/PlanGate";
import { getIsFreeTier } from "@/lib/entitlements/isFreeTier";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";
import { recordAndCheckRate } from "@/lib/security/rateLimit";
import { getAppLocale } from "@/lib/i18n";
import { FreeFeaturePreview } from "../components/FreeFeaturePreview";
import { FutureProjectProfilePreview } from "./FutureProjectProfilePreview";
import { SectionHero } from "../components/SectionHero";
import { OpportunityFilters } from "./OpportunityFilters";

export const metadata: Metadata = { title: "Proyectos Futuros" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const RENEWABLE_AND_STORAGE_CODES = [
  "solar_pv",
  "wind",
  "hydro",
  "pumped_hydro",
  "bess",
  "hybrid",
  "biomass",
  "geothermal",
];

const TABS: Array<{ key: "esperados" | "historico"; label: string }> = [
  { key: "esperados", label: "Esperados" },
  { key: "historico", label: "Histórico" },
];

function compactMw(value: number): string {
  if (value >= 1_000) return `${(value / 1_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} GW`;
  return `${Math.round(value).toLocaleString("es-CL")} MW`;
}

function buildHref(params: Record<string, string | undefined>, overrides: Record<string, string | undefined>): string {
  const merged = { ...params, ...overrides };
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) qs.set(key, value);
  }
  const query = qs.toString();
  return query ? `/proyectos?${query}` : "/proyectos";
}

export default async function ProyectosEsperadosPage({
  searchParams,
}: {
  searchParams: Promise<{ tech?: string; page?: string; tab?: string; q?: string; etapa?: string; mesDesde?: string; mesHasta?: string }>;
}) {
  const params = await searchParams;
  const locale = await getAppLocale();
  const page = Number(params.page ?? "1") || 1;
  // "Histórico" deshabilitado temporalmente en el sitio público hasta terminar de
  // verificar ese lote (2026-07-27) — se sigue pudiendo pedir por URL, pero se ignora acá
  // para no exponer datos históricos todavía sin revisar. El tab queda visible pero
  // deshabilitado más abajo, en vez de ocultarlo, para que quede claro que viene después.
  const HISTORICO_HABILITADO = false;
  const tab = HISTORICO_HABILITADO && params.tab === "historico" ? "historico" : "esperados";
  const selectedKeys = parseChipKeys(params.tech).filter((key) => key !== "termica" && key !== "transmision");
  const selectedTechnologyCodes = chipsToTechnologyCodes(selectedKeys);
  const technologyCodes = selectedTechnologyCodes.length > 0 ? selectedTechnologyCodes : RENEWABLE_AND_STORAGE_CODES;
  const namePatterns = chipsToNamePatterns(selectedKeys);
  const search = params.q;
  const etapaGroup = params.etapa as PhaseGroup | undefined;
  const mesDesde = Number(params.mesDesde ?? "0") || 0;
  const mesHasta = Number(params.mesHasta ?? String(MONTHS_HORIZON)) || MONTHS_HORIZON;
  const hasDateRangeFilter = tab === "esperados" && (mesDesde > 0 || mesHasta < MONTHS_HORIZON);

  // Para un admin devuelve el cliente de servicio: su sesión no es de Supabase
  // y sin esto la página le sale vacía (ver supabase-page-client.ts).
  const client = await createSupabasePageClient();

  // Instrumentación anti-scraping (docs/09-seguridad.md §9.4/9.6) — best-effort,
  // nunca debe romper el render de la página si falla.
  try {
    const profile = await getCurrentUserProfile(client);
    if (profile) await recordAndCheckRate(profile.id, "project_list", { limit: 30, windowSeconds: 300 });
  } catch {
    // no-op
  }

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
    // Los que ya tienen obra en curso arriba (ver listProjects).
    constructionFirst: tab === "esperados",
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
    seiaStatusByProjectId,
    ageBenchmarks,
    solicitudes7d,
    admin,
  ] = await Promise.all([
    listProjects(client, { ...filters, projectIds: etapaProjectIds }, page, PAGE_SIZE),
    getProjectsForMap(client, { technologyCodes, namePatterns, search }),
    getPipelineFunnel(client),
    getConnectionCalendar(client),
    getSeiaStatusesForUpcomingProjects(client),
    getRequestAgeBenchmarks(client),
    getRecentSolicitudesCount(client, 7),
    isAdmin(),
  ]);
  const isFree = !admin && (await getIsFreeTier(client));
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));
  const seiaByProjectId = await getSeiaRecordsForProjects(
    client,
    result.items.map((p) => p.id),
  );
  const pgpProgressByProjectId = await getLatestPgpProgressForProjects(
    client,
    result.items.map((p) => p.id),
  );

  // Los mismos chips de tecnología que ya filtran la tabla/mapa de arriba
  // también acotan el embudo de madurez, el calendario de hitos y la demanda
  // de equipos — así el usuario puede seleccionar "Solar" o "BESS" y ver
  // cuántos MW se esperan solo para esa tecnología, sin un control aparte.
  const hasTechFilter = technologyCodes.length > 0 || namePatterns.length > 0;
  const etapaIdSet = etapaProjectIds ? new Set(etapaProjectIds) : null;
  const normalizedSearch = search?.trim().toLowerCase();
  const analysisDateFrom = filters.connectionDateFrom;
  const analysisDateTo = filters.connectionDateTo;
  const filteredScheduleInputs = scheduleInputs.filter((item) => {
    const matchesTechnology =
      !hasTechFilter ||
      (!!item.technologyCode && technologyCodes.includes(item.technologyCode)) ||
      namePatterns.some((pattern) => item.name.toLowerCase().includes(pattern.toLowerCase()));
    const matchesSearch = !normalizedSearch || item.name.toLowerCase().includes(normalizedSearch);
    const matchesStage = !etapaIdSet || etapaIdSet.has(item.id);
    const matchesDateFrom =
      !analysisDateFrom || (!!item.estimatedConnectionDate && item.estimatedConnectionDate >= analysisDateFrom);
    const matchesDateTo =
      !analysisDateTo || (!!item.estimatedConnectionDate && item.estimatedConnectionDate <= analysisDateTo);
    return matchesTechnology && matchesSearch && matchesStage && matchesDateFrom && matchesDateTo;
  });

  const forecast = computeScheduleForecast(filteredScheduleInputs);

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
  // No usar pipelineByTechnology acá: esa agrupación clasifica cada proyecto por una
  // sola tecnología canónica (para poder cruzar Pipeline/Construcción/Operación en un
  // mismo heatmap — ver marketTechCategories.ts), así que un híbrido "Solar con
  // Baterías" cae en "Híbrido", no en "BESS", y este contador quedaba muy por debajo
  // de lo que el buscador encuentra por nombre. includesStorage sí marca cualquier
  // proyecto con batería sin importar su tecnología principal.
  const projectNameSuggestions = [...new Set(scheduleInputs.map((project) => project.name).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, locale === "en" ? "en" : "es"));
  const activeFilterLabels = [
    ...TECH_CHIPS.filter((chip) => selectedKeys.includes(chip.key)).map((chip) => chip.label),
    search ? `“${search}”` : undefined,
    etapaGroup ? PHASE_GROUP_LABELS[etapaGroup] : undefined,
    hasDateRangeFilter ? "rango de fecha de conexión" : undefined,
  ].filter(Boolean);
  const storageProjects = filteredScheduleInputs.filter((project) => project.includesStorage || project.technologyCode === "bess");
  const storageCapacityMw = storageProjects.reduce((sum, project) => sum + (project.capacityMw ?? 0), 0);
  const constructionProjects = filteredScheduleInputs.filter((project) => {
    const phase = computeEstimatedPhase(project.estimatedConnectionDate, project.technologyCode, project.includesStorage, project.capacityMw);
    return phase?.currentPhase != null && PHASE_TO_GROUP[phase.currentPhase] === "construccion";
  });
  return (
    <div className="flex flex-col gap-6 pb-4">
      <SectionHero
        eyebrow="Inteligencia de mercado"
        title={locale === "en" ? "Future projects" : "Proyectos Futuros"}
        description={
          locale === "en"
            ? "Identify upcoming energy projects, assess their progress, and focus your commercial effort where it matters."
            : "Encuentra proyectos, identifica oportunidades y entiende las señales que anticipan el próximo movimiento del mercado."
        }
        actions={
          <>
            <Link href="#lista-proyectos" className="inline-flex items-center gap-2 rounded-lg border border-white/18 bg-white/5 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-white/10"><Filter size={15} /> {locale === "en" ? "Filter projects" : "Filtrar proyectos"}</Link>
            <Link href="/mapa" className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-3.5 py-2 text-sm font-semibold text-[#052020] transition hover:bg-[#63e3d4]"><MapPinned size={15} /> {locale === "en" ? "View map" : "Ver mapa"}</Link>
          </>
        }
        metrics={[
          { label: locale === "en" ? "Identified projects" : "Proyectos identificados", value: pipelineTotals.count.toLocaleString("es-CL"), detail: search || hasTechFilter ? "según los filtros activos" : "pipeline vigente" },
          { label: locale === "en" ? "Capacity in development" : "Capacidad en desarrollo", value: compactMw(pipelineTotals.totalCapacityMw), detail: "renovable y almacenamiento" },
          { label: "BESS / híbridos", value: compactMw(storageCapacityMw), detail: `${storageProjects.length.toLocaleString("es-CL")} proyectos con almacenamiento` },
          { label: locale === "en" ? "Near construction" : "Próximos a construcción", value: constructionProjects.length.toLocaleString("es-CL"), detail: constructionProjects.length ? "etapa estimada de construcción" : "sin proyectos en esta etapa" },
          { label: locale === "en" ? "High COD confidence" : "Alta confianza de COD", value: `${pipelineHealth.altaPct}%`, detail: `${pipelineHealth.alta.toLocaleString("es-CL")} proyectos evaluables` },
        ]}
      />

      {false && <ModuleGuide
        purpose={locale === "en" ? "Identify relevant future projects before they enter operation and organize them by technology, stage, date and scale." : "Detectar proyectos futuros relevantes antes de que entren en operación y ordenarlos por tecnología, etapa, fecha y escala."}
        deliverables={locale === "en" ? ["Current list of identified projects", "Estimated dates, capacity, technology and developer", "Individual project profiles and progress signals"] : ["Listado vigente de proyectos identificados", "Fechas estimadas, capacidad, tecnología y desarrollador", "Acceso a fichas individuales y señales de avance"]}
        howToUse={locale === "en" ? ["Filter projects for your target market", "Open the best-fit project profiles", "Follow priority projects and review changes"] : ["Filtre los proyectos según su mercado objetivo", "Abra las fichas con mejor encaje", "Siga los proyectos prioritarios y revise sus cambios"]}
        plan="Free"
        upgradeMessage={locale === "en" ? "Free lets you explore identified projects; Prime unlocks full profiles, dynamic analysis and continuous tracking." : "Free permite explorar los proyectos identificados; Prime desbloquea fichas completas, análisis dinámico y seguimiento continuo."}
        locale={locale}
      />}

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
                {locale === "en" ? "Historical" : t.label} <span className="text-xs">({locale === "en" ? "coming soon" : "próximamente"})</span>
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
              {locale === "en" ? (t.key === "esperados" ? "Expected" : "Historical") : t.label}
            </Link>
          );
        })}
      </div>
      {tab === "historico" && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Todo lo que ya pasó de fecha, más lo rechazado o desistido, sin importar la fecha.
        </p>
      )}

      <section id="lista-proyectos" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-primary">Explorador</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">{locale === "en" ? "Project opportunities" : "Oportunidades de proyectos"}</h2>
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{result.totalCount.toLocaleString("es-CL")} {locale === "en" ? "results available" : "resultados disponibles"}</p>
        </div>
        <Panel className="flex flex-col gap-5 border-brand-primary/20 bg-white p-5 shadow-sm dark:border-brand-primary/15 dark:bg-neutral-950">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{locale === "en" ? "Filter projects" : "Filtre los proyectos"}</h3><p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{locale === "en" ? "Combine technologies and search to find relevant projects or opportunities." : "Combine tecnologías y búsqueda para encontrar el proyecto u oportunidad relevante."}</p></div>{(hasTechFilter || search || Boolean(etapaGroup) || hasDateRangeFilter) && <Link href={buildHref(params, { tech: undefined, q: undefined, etapa: undefined, mesDesde: undefined, mesHasta: undefined, page: undefined })} className="text-sm font-medium text-neutral-600 underline underline-offset-2 hover:text-brand-primary dark:text-neutral-300">{locale === "en" ? "Reset filters" : "Restablecer filtros"}</Link>}</div>
        <OpportunityFilters
          basePath="/proyectos"
          locale={locale}
          search={search}
          selectedKeys={selectedKeys}
          excludeKeys={["termica", "transmision"]}
          etapa={etapaGroup}
          showEtapa={tab === "esperados"}
          suggestions={projectNameSuggestions}
        />
        {activeFilterLabels.length > 0 && <p className="border-t border-neutral-200 pt-3 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-300"><span className="font-medium">{locale === "en" ? "Current view:" : "Vista actual:"}</span> {activeFilterLabels.join(" · ")}</p>}
        </Panel>
      </section>

      {isFree && (
        <FreeFeaturePreview
          locale={locale}
          wide
          title={locale === "en" ? "See the detail available for each future project" : "Así se presenta cada proyecto futuro"}
          description={locale === "en" ? "Prime brings together technical capacity, connection progress, environmental status and commercial context in one profile." : "Prime reúne capacidad técnica, avance de conexión, estado ambiental y contexto comercial en una sola ficha."}
        >
          <FutureProjectProfilePreview locale={locale} />
        </FreeFeaturePreview>
      )}

      <Panel className="flex flex-col gap-4 overflow-hidden p-0">
        <div><ProjectTable items={result.items} seiaByProjectId={seiaByProjectId} pgpProgressByProjectId={pgpProgressByProjectId} isFree={isFree} locale={locale} /></div>
        <div className="px-5 pb-5"><Pager page={page} totalPages={totalPages} buildHref={(p) => buildHref(params, { page: String(p) })} /></div>
      </Panel>

      {false && (
      <section className="flex flex-col gap-5" aria-labelledby="dynamic-analysis-title">
        <div>
          <h2 id="dynamic-analysis-title" className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
            Análisis dinámico
          </h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Filtre los proyectos futuros y abra el análisis con los indicadores recalculados para esa selección.
          </p>
        </div>
        <Panel className="flex flex-col gap-5 border-brand-primary/20 bg-white p-5 shadow-sm dark:border-brand-primary/15 dark:bg-neutral-950">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Filtros del análisis</h3>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Tecnología, proyecto, etapa y horizonte de conexión.</p>
            </div>
            {(hasTechFilter || search || Boolean(etapaGroup) || hasDateRangeFilter) && (
              <Link href={buildHref(params, { tech: undefined, q: undefined, etapa: undefined, mesDesde: undefined, mesHasta: undefined, page: undefined })} className="text-sm font-medium text-neutral-600 underline underline-offset-2 hover:text-brand-primary dark:text-neutral-300">
                Restablecer filtros
              </Link>
            )}
          </div>
          <SearchBar
            basePath="/proyectos"
            value={search}
            otherParams={{ tab: tab === "esperados" ? undefined : tab, tech: params.tech }}
            placeholder="Buscar proyecto para analizar..."
            suggestions={projectNameSuggestions}
          />
          <div className="flex flex-wrap gap-4">
            <TechSelectFilter basePath="/proyectos" selectedKeys={selectedKeys} excludeKeys={["termica", "transmision"]} />
            {tab === "esperados" && <EtapaFilter basePath="/proyectos" />}
          </div>
          {activeFilterLabels.length > 0 ? (
            <p className="border-t border-neutral-200 pt-3 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
              <span className="font-medium">Análisis actual:</span> {activeFilterLabels.join(" · ")}
            </p>
          ) : (
            <p className="border-t border-neutral-200 pt-3 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
              Mostrando todos los proyectos futuros.
            </p>
          )}
          <AnalysisDrawer
            triggerVariant="inline"
            title="Análisis detallado de proyectos futuros"
            description="Indicadores recalculados para los filtros seleccionados."
          >
        <div className="rounded-2xl border border-brand-primary/25 bg-brand-surface p-5 dark:bg-brand-primary/10">
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Cómo leer este análisis</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">Comience por el panorama actual y la salud de los proyectos; después revise regiones y antigüedad; finalmente utilice los calendarios y la demanda de equipos para identificar ventanas comerciales.</p>
        </div>
        <Panel className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
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
            <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              Pipeline Health
            </h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Respeta el filtro de tecnología de arriba.</p>
          </div>
          <PipelineHealthBar health={pipelineHealth} />
        </Panel>

        <Panel className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
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
            <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
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
            <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
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
            <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
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
            <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
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
        </Panel>
      </section>
      )}
    </div>
  );
}
