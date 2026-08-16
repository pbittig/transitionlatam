import Link from "next/link";
import type { Metadata } from "next";
import {
  Activity,
  ArrowUpRight,
  BatteryCharging,
  ChartNoAxesCombined,
  FolderKanban,
  Gauge,
  Layers3,
  Radar,
  Search,
} from "lucide-react";
import { isAdmin } from "@/lib/auth/session";
import { createSupabasePageClient } from "@/lib/data-access/supabase-page-client";
import { getIsFreeTier } from "@/lib/entitlements/isFreeTier";
import { getSeiaStatusesForUpcomingProjects, getUpcomingScheduleInputs } from "@/lib/data-access/pipeline";
import { computeEstimatedPhase } from "@/lib/shared/computeEstimatedPhase";
import { PHASE_COLORS, PHASE_GROUP_LABELS, PHASE_TO_GROUP, type PhaseGroup } from "@/lib/shared/projectPhaseDurations";
import { computePipelineHealth, computePipelineTotals } from "@/lib/shared/marketSnapshot";
import { computeScheduleForecast, FORECAST_PHASE_LABELS } from "@/lib/shared/scheduleForecast";
import { chipsToNamePatterns, chipsToTechnologyCodes, parseChipKeys, TECH_CHIPS } from "../components/techChips";
import { AnalysisMultiFilters } from "../components/AnalysisMultiFilters";
import { MilestoneCalendarChart } from "../components/MilestoneCalendarChart";
import { Panel } from "../components/Panel";
import { PipelineHealthBar } from "../components/PipelineHealthBar";
import { PlanGate } from "../components/PlanGate";

export const metadata: Metadata = { title: "Análisis dinámico" };
export const dynamic = "force-dynamic";

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

export default async function AnalisisDinamicoPage({
  searchParams,
}: {
  searchParams: Promise<{ tech?: string; etapa?: string }>;
}) {
  const params = await searchParams;
  const selectedKeys = parseChipKeys(params.tech).filter((key) => key !== "termica" && key !== "transmision");
  const technologyCodes = chipsToTechnologyCodes(selectedKeys);
  const namePatterns = chipsToNamePatterns(selectedKeys);
  const etapas = params.etapa?.split(",").filter(Boolean) as PhaseGroup[] | undefined;
  const hasTechnologyFilter = technologyCodes.length > 0 || namePatterns.length > 0;

  const client = await createSupabasePageClient();
  const admin = await isAdmin();
  const isFree = !admin && (await getIsFreeTier(client));
  if (isFree) return <LockedAnalysisPage />;

  const [allProjects, seiaStatuses] = await Promise.all([
    getUpcomingScheduleInputs(client),
    getSeiaStatusesForUpcomingProjects(client),
  ]);

  const projects = allProjects.filter((project) => {
    const isRenewableOrStorage =
      (!!project.technologyCode && RENEWABLE_AND_STORAGE_CODES.includes(project.technologyCode)) ||
      project.includesStorage;
    const technologyMatch =
      !hasTechnologyFilter ||
      (!!project.technologyCode && technologyCodes.includes(project.technologyCode)) ||
      namePatterns.some((pattern) => project.name.toLowerCase().includes(pattern.toLowerCase()));
    const phase = computeEstimatedPhase(
      project.estimatedConnectionDate,
      project.technologyCode,
      project.includesStorage,
      project.capacityMw,
    );
    const phaseMatch =
      !etapas?.length ||
      (phase?.currentPhase != null && etapas.includes(PHASE_TO_GROUP[phase.currentPhase]));
    return isRenewableOrStorage && technologyMatch && phaseMatch;
  });

  const totals = computePipelineTotals(projects);
  const health = computePipelineHealth(projects, seiaStatuses);
  const forecast = computeScheduleForecast(projects);
  const bessCount = projects.filter((project) => project.includesStorage).length;
  const capacityMw = projects.reduce((sum, project) => sum + (project.capacityMw ?? 0), 0);
  const activeLabels = [
    ...TECH_CHIPS.filter((chip) => selectedKeys.includes(chip.key)).map((chip) => chip.label),
    ...(etapas ?? []).map((stage) => PHASE_GROUP_LABELS[stage]),
  ].filter(Boolean);

  const metrics = [
    {
      icon: FolderKanban,
      label: "Proyectos",
      value: totals.count.toLocaleString("es-CL"),
      detail: "en la selección",
      iconStyle: "bg-brand-primary/10 text-brand-deep",
    },
    {
      icon: Activity,
      label: "Capacidad",
      value: `${(capacityMw / 1000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} GW`,
      detail: "capacidad futura",
      iconStyle: "bg-brand-primary/10 text-brand-deep",
    },
    {
      icon: BatteryCharging,
      label: "Con BESS",
      value: bessCount.toLocaleString("es-CL"),
      detail: "incluyen almacenamiento",
      iconStyle: "bg-brand-primary/10 text-brand-deep",
    },
    {
      icon: Gauge,
      label: "Riesgo alto",
      value: `${health.bajaPct}%`,
      detail: "de la selección",
      iconStyle: "bg-brand-primary/10 text-brand-deep",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-black via-[#272727] to-[#333333] px-6 py-8 text-white shadow-[0_24px_70px_-35px_rgba(0,0,0,0.35)] sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full border border-white/10 bg-white/5" />
        <div className="pointer-events-none absolute -right-8 -bottom-28 size-72 rounded-full border border-brand-primary/25 bg-brand-primary/10" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Análisis dinámico</h1>
          </div>
          <Link
            href="/proyectos"
            className="group inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20"
          >
            Abrir proyectos futuros
            <ArrowUpRight size={16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">Construye el análisis en tres pasos</h2>
            <p className="mt-1 text-sm text-neutral-500">Combina filtros para obtener una lectura enfocada de la cartera.</p>
          </div>
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              { number: "1", icon: Search, title: "Filtre", description: "Seleccione la tecnología y etapa que desea analizar." },
              { number: "2", icon: Layers3, title: "Combina", description: "Cruza los criterios para analizar solamente la cartera relevante." },
              { number: "3", icon: ChartNoAxesCombined, title: "Interprete", description: "Revise escala, riesgo y calendario; los resultados se recalculan automáticamente." },
            ].map(({ number, icon: Icon, title, description }) => (
              <li key={number} className="rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-900">
                <div className="flex items-center justify-between">
                  <span className="flex size-7 items-center justify-center rounded-full bg-brand-primary/15 text-xs font-bold text-brand-deep dark:text-brand-primary">
                    {number}
                  </span>
                  <span className="flex size-9 items-center justify-center rounded-xl bg-white text-brand-deep shadow-sm ring-1 ring-neutral-100 dark:bg-neutral-800 dark:text-brand-primary dark:ring-neutral-700">
                    <Icon size={18} />
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-neutral-500">{description}</p>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel className="border-brand-primary/25">
          <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">Una lectura enfocada de la cartera</h2>
          <p className="mt-1 text-sm text-neutral-500">Revise escala, composición, riesgo y calendario probable para la selección actual.</p>
          <ul className="mt-4 grid gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            {[
              "Cantidad de proyectos y capacidad total en MW/GW.",
              "Proyectos que incorporan almacenamiento BESS.",
              "Distribución de la cartera según su nivel de riesgo.",
              "Fechas probables de los próximos hitos del proyecto.",
            ].map((result) => (
              <li key={result} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-primary" />
                <span>{result}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </section>

      <Panel className="relative flex flex-col gap-6 overflow-hidden !rounded-3xl !border-brand-primary/40 !bg-[#f1faf7] p-7 shadow-[0_18px_50px_-32px_rgba(10,111,96,0.7)] dark:!bg-[#0c211f] sm:p-8">
        <div className="pointer-events-none absolute -top-20 -right-16 size-52 rounded-full bg-brand-primary/10" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">Filtros de análisis</h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">Seleccione tecnología y etapa para construir su vista.</p>
          </div>
          {activeLabels.length > 0 && (
            <Link
              href="/analisis-dinamico"
              className="rounded-full border border-neutral-200 px-3 py-1.5 text-sm font-medium transition hover:border-brand-primary hover:text-brand-deep dark:border-neutral-700 dark:hover:text-brand-primary"
            >
              Restablecer filtros
            </Link>
          )}
        </div>
        <AnalysisMultiFilters />
        <div className="relative flex items-center gap-2 rounded-xl bg-brand-deep px-4 py-3 text-sm text-white">
          <Radar size={16} className="shrink-0 text-brand-primary" />
          <span className="text-white/65">Vista activa:</span>
          <span className="font-medium">{activeLabels.length ? activeLabels.join(" · ") : "todos los proyectos futuros"}</span>
        </div>
      </Panel>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">Magnitud y perfil de riesgo</h2>
          <p className="mt-1 text-sm text-neutral-500">Indicadores calculados para los filtros seleccionados.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(({ icon: Icon, label, value, detail, iconStyle }) => (
            <Panel key={label} className="border-neutral-200">
              <div className="flex items-center justify-between text-xs font-medium text-neutral-500">
                <span>{label}</span>
                <span className={`rounded-lg p-2 ${iconStyle}`}>
                  <Icon size={16} />
                </span>
              </div>
              <p className="mt-4 text-2xl font-semibold">{value}</p>
              <p className="mt-1 text-xs text-neutral-500">{detail}</p>
            </Panel>
          ))}
        </div>
      </section>

      <Panel className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Pipeline Health</h2>
          <p className="text-sm text-neutral-500">Salud estimada de los proyectos filtrados.</p>
        </div>
        <PipelineHealthBar health={health} />
      </Panel>

      <Panel className="flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-semibold">Calendario de hitos</h2>
          <p className="text-sm text-neutral-500">Fechas probabilísticas recalculadas para la selección.</p>
        </div>
        {forecast.milestoneCalendars.map(({ phase, entries }) => (
          <div key={phase}>
            <h3 className="mb-2 text-sm font-medium">{FORECAST_PHASE_LABELS[phase]}</h3>
            <MilestoneCalendarChart entries={entries} color={PHASE_COLORS[phase]} />
          </div>
        ))}
      </Panel>
    </div>
  );
}

function LockedAnalysisPage() {
  const deliverables = [
    { icon: FolderKanban, title: "Cartera dimensionada", description: "Cantidad de proyectos y capacidad total para cada selección." },
    { icon: Gauge, title: "Perfil de riesgo", description: "Distribución de la cartera según su nivel de avance estimado." },
    { icon: BatteryCharging, title: "Lectura tecnológica", description: "Comparación de renovables, híbridos y proyectos con BESS." },
    { icon: ChartNoAxesCombined, title: "Calendario probable", description: "Proyección de los próximos hitos de los proyectos analizados." },
  ];

  return (
    <div className="flex flex-col gap-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-black via-[#272727] to-[#333333] px-6 py-9 text-white shadow-xl shadow-black/10 sm:px-8 sm:py-11">
        <div className="pointer-events-none absolute -top-24 right-0 size-72 rounded-full border border-white/10 bg-white/5" />
        <div className="relative max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Análisis dinámico</h1>
          <Link href="/planes" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-ink shadow-sm transition hover:-translate-y-0.5">
            Ver planes con acceso
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">Qué obtienes con esta sección</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            Una vista recalculada según los criterios que selecciones, lista para entender dónde se concentra la oportunidad y qué hitos vienen.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {deliverables.map(({ icon: Icon, title, description }) => (
            <Panel key={title} className="border-neutral-200">
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-deep dark:text-brand-primary">
                <Icon size={19} />
              </span>
              <h3 className="mt-4 font-semibold text-neutral-950 dark:text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-500">{description}</p>
            </Panel>
          ))}
        </div>
      </section>

      <PlanGate
        locked
        variant="showcase"
        title="Desbloquee su análisis de proyectos"
        description="Seleccione varias tecnologías y etapas para recalcular automáticamente el tamaño, riesgo y cronograma de la oportunidad."
        features={[
          "Multiselector de tecnologías renovables y BESS",
          "Comparación simultánea de etapas",
          "Indicadores de capacidad y riesgo",
          "Calendario probabilístico de hitos",
        ]}
      >
        <div className="grid min-h-72 gap-4 p-6 sm:grid-cols-2 xl:grid-cols-4">
          {["Proyectos", "Capacidad", "Con BESS", "Riesgo alto"].map((label, index) => (
            <div key={label} className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs text-neutral-500">{label}</p>
              <p className="mt-5 text-3xl font-semibold">{[124, "8,6 GW", 47, "18%"][index]}</p>
            </div>
          ))}
        </div>
      </PlanGate>
    </div>
  );
}
