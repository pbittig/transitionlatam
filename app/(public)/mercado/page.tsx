import type { Metadata } from "next";
import Link from "next/link";
import { Activity, BatteryCharging, Building2, ChartNoAxesCombined, Factory, MapPin, Zap } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getPowerPlantRegionBubbles, getPowerPlantStats, listPowerPlants } from "@/lib/data-access/powerPlants";
import { getConstructionStats, getConstructionProjects } from "@/lib/data-access/construction";
import { getUpcomingScheduleInputs } from "@/lib/data-access/pipeline";
import { computePipelineByTechnology } from "@/lib/shared/marketSnapshot";
import { MARKET_TECH_CATEGORIES, constructionTechToCategory, operationPlantTypeToCategory } from "@/lib/shared/marketTechCategories";
import { chipsToNamePatterns, chipsToPlantTypes, parseChipKeys, TECH_CHIPS } from "../components/techChips";
import { TechChipFilter } from "../components/TechChipFilter";
import { SearchBar } from "../components/SearchBar";
import { PowerPlantTable } from "../components/PowerPlantTable";
import { ConstructionProjectTable } from "../components/ConstructionProjectTable";
import { Pager } from "../components/Pager";
import { BarList } from "../components/BarList";
import { IndexTile } from "../components/IndexTile";
import { BubbleChart } from "../components/BubbleChart";
import { Panel } from "../components/Panel";
import { AnalysisDrawer } from "../components/AnalysisDrawer";
import { MarketSnapshotList } from "../components/MarketSnapshotList";
import { TechStageHeatmap, type HeatmapColumn } from "../components/TechStageHeatmap";

export const metadata: Metadata = { title: "Mercado — Transition LATAM" };
export const dynamic = "force-dynamic";

const STATUS_OPTIONS = ["Operativa", "En Construcción", "Fuera de Servicio"];
const PAGE_SIZE = 20;

function concentrationLabel(hhi: number): string {
  if (hhi < 1500) return "baja";
  if (hhi < 2500) return "moderada";
  return "alta";
}

function buildHref(params: Record<string, string | undefined>, overrides: Record<string, string | undefined>): string {
  const merged = { ...params, ...overrides };
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) qs.set(key, value);
  }
  const query = qs.toString();
  return query ? `/mercado?${query}` : "/mercado";
}

export default async function MercadoPage({
  searchParams,
}: {
  searchParams: Promise<{ tech?: string; estado?: string; page?: string; q?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1") || 1;
  const selectedKeys = parseChipKeys(params.tech);
  const plantTypes = chipsToPlantTypes(selectedKeys);
  const namePatterns = chipsToNamePatterns(selectedKeys);
  const search = params.q;
  const hasFilter = plantTypes.length > 0 || namePatterns.length > 0 || !!params.estado || !!search;

  const client = await createSupabaseServerClient();

  const [stats, regionBubbles, plantList, constructionStats, constructionProjects, scheduleInputs] = await Promise.all([
    getPowerPlantStats(client),
    getPowerPlantRegionBubbles(client),
    listPowerPlants(client, { status: params.estado, plantTypes, namePatterns, search }, page, PAGE_SIZE),
    getConstructionStats(client),
    getConstructionProjects(client),
    getUpcomingScheduleInputs(client),
  ]);
  const totalPages = Math.max(1, Math.ceil(plantList.totalCount / plantList.pageSize));

  const topOwner = stats.topOwners[0];
  const topOwnerShare = topOwner && stats.operatingCapacityMw > 0 ? (topOwner.capacityMw / stats.operatingCapacityMw) * 100 : 0;
  const topRegion = [...regionBubbles].sort((a, b) => b.capacityMw - a.capacityMw)[0];

  const marketInsights = [
    topOwner &&
      `${topOwner.owner} concentra el ${topOwnerShare.toFixed(1)}% de la capacidad operativa del país (${Math.round(topOwner.capacityMw).toLocaleString("es-CL")} MW en ${topOwner.plantCount} centrales).`,
    `El mercado de generación opera con una concentración ${concentrationLabel(stats.marketConcentrationIndex)} (HHI = ${Math.round(stats.marketConcentrationIndex).toLocaleString("es-CL")}).`,
    topRegion &&
      `${topRegion.region} concentra la mayor capacidad instalada del país (${Math.round(topRegion.capacityMw).toLocaleString("es-CL")} MW), liderada por ${topRegion.dominantTechnology.toLowerCase()}.`,
  ].filter(Boolean) as string[];

  // Heatmap Tecnología × Etapa — normaliza las tres fuentes (plant_type, tipo_tecnologia_final, technology.code) a las mismas categorías.
  const pipelineByTechnology = computePipelineByTechnology(scheduleInputs);
  const operationValues: Partial<Record<(typeof MARKET_TECH_CATEGORIES)[number], number>> = {};
  for (const t of stats.byTechnology) {
    const cat = operationPlantTypeToCategory(t.technology);
    if (cat) operationValues[cat] = (operationValues[cat] ?? 0) + t.capacityMw;
  }
  const constructionValues: Partial<Record<(typeof MARKET_TECH_CATEGORIES)[number], number>> = {};
  for (const p of constructionProjects) {
    const cat = constructionTechToCategory(p.tipoTecnologiaFinal);
    if (cat) constructionValues[cat] = (constructionValues[cat] ?? 0) + (p.potenciaNetaMw ?? 0);
  }
  const pipelineValues: Partial<Record<(typeof MARKET_TECH_CATEGORIES)[number], number>> = {};
  for (const t of pipelineByTechnology) {
    pipelineValues[t.category] = t.capacityMw;
  }
  const pipelineTotalMw = pipelineByTechnology.reduce((sum, item) => sum + item.capacityMw, 0);
  const heatmapColumns: HeatmapColumn[] = [
    { key: "operacion", label: "Operación", values: operationValues },
    { key: "construccion", label: "Construcción", values: constructionValues },
    { key: "pipeline", label: "Pipeline", values: pipelineValues },
  ];
  // Proyectos con BESS: standalone (tecnología final = BESS) o incorporado a otra
  // central (proyecto_bess_asociado) — la única fuente con esta granularidad hoy
  // es la Declaración en Construcción de la CNE, no el registro de centrales operativas.
  const bessProjects = constructionProjects.filter(
    (p) => /bess/i.test(p.tipoTecnologiaFinal ?? "") || p.proyectoBessAsociado,
  );
  const bessTotalMw = bessProjects.reduce((sum, p) => sum + (p.potenciaNetaMw ?? 0), 0);
  const activeFilterLabels = [
    ...TECH_CHIPS.filter((chip) => selectedKeys.includes(chip.key)).map((chip) => chip.label),
    params.estado,
    search ? `“${search}”` : undefined,
  ].filter(Boolean);
  const constructionVsOperation = stats.operatingCapacityMw > 0
    ? (constructionStats.totalPotenciaMw / stats.operatingCapacityMw) * 100
    : 0;
  const executiveSignals = [
    {
      icon: Factory,
      label: "Estructura competitiva",
      title: `Concentración ${concentrationLabel(stats.marketConcentrationIndex)}`,
      value: `HHI ${Math.round(stats.marketConcentrationIndex).toLocaleString("es-CL")}`,
      guidance: "Úsalo para dimensionar cuán fragmentado está el parque entre propietarios y contextualizar posibles contrapartes.",
      color: "text-brand-deep bg-brand-surface dark:text-brand-primary dark:bg-brand-primary/10",
    },
    {
      icon: MapPin,
      label: "Concentración territorial",
      title: topRegion?.region ?? "Sin región dominante",
      value: topRegion ? `${Math.round(topRegion.capacityMw).toLocaleString("es-CL")} MW instalados` : "Sin datos suficientes",
      guidance: "Sirve para priorizar análisis regionales de conexión, proveedores, operación y nueva demanda.",
      color: "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/10",
    },
    {
      icon: Building2,
      label: "Expansión en ejecución",
      title: `${constructionStats.count.toLocaleString("es-CL")} proyectos en construcción`,
      value: `${constructionVsOperation.toLocaleString("es-CL", { maximumFractionDigits: 1 })}% de la capacidad operativa`,
      guidance: "Compara el volumen en construcción con la base operativa para estimar la magnitud del cambio ya comprometido.",
      color: "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10",
    },
  ];

  return (
    <div className="flex flex-col gap-10">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-ink via-brand-deep to-[#1b8d83] px-6 py-8 text-white shadow-xl shadow-brand-deep/10 md:px-8 md:py-10">
        <span className="absolute -top-20 right-10 h-52 w-52 rounded-full border border-white/10" aria-hidden />
        <span className="absolute -right-10 -bottom-24 h-64 w-64 rounded-full bg-brand-primary/15 blur-2xl" aria-hidden />
        <div className="relative">
          <p className="flex items-center gap-2 text-xs font-medium tracking-[0.14em] text-brand-primary uppercase"><Zap size={14} /> Mercado eléctrico · Chile</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Infraestructura del sistema</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75 md:text-base">
          Lee el sistema como una sola cartera: infraestructura operativa, obras en construcción y la capacidad que busca conexión. Fuentes: CNE y Coordinador Eléctrico Nacional.
          </p>
        </div>
      </section>

      <section aria-labelledby="system-summary-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-brand-deep uppercase dark:text-brand-primary">Foto del sistema</p>
            <h2 id="system-summary-title" className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">Capacidad por etapa de desarrollo</h2>
          </div>
          <p className="max-w-md text-sm text-neutral-500 dark:text-neutral-400">Compara lo que ya opera, lo que se está construyendo y lo que todavía busca materializarse.</p>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: Activity, label: "En operación", value: `${(stats.operatingCapacityMw / 1000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} GW`, detail: `${stats.totalPlants.toLocaleString("es-CL")} centrales registradas`, accent: "border-t-brand-primary", iconClass: "bg-brand-surface text-brand-deep dark:bg-brand-primary/10 dark:text-brand-primary" },
            { icon: Building2, label: "En construcción", value: `${(constructionStats.totalPotenciaMw / 1000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} GW`, detail: `${constructionStats.count.toLocaleString("es-CL")} proyectos declarados`, accent: "border-t-data-solar", iconClass: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" },
            { icon: ChartNoAxesCombined, label: "Proyectos futuros", value: `${(pipelineTotalMw / 1000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} GW`, detail: "capacidad en cartera de conexión", accent: "border-t-data-blue", iconClass: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" },
            { icon: BatteryCharging, label: "BESS en construcción", value: `${(bessTotalMw / 1000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} GW`, detail: `${bessProjects.length.toLocaleString("es-CL")} proyectos con baterías`, accent: "border-t-data-bess", iconClass: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300" },
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

      <section className="rounded-3xl border border-brand-primary/25 bg-gradient-to-br from-brand-surface via-white to-white p-6 dark:via-neutral-950 dark:to-neutral-950" aria-labelledby="executive-reading-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-brand-deep uppercase dark:text-brand-primary">Lectura ejecutiva</p>
            <h2 id="executive-reading-title" className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">Qué muestran los datos y cómo utilizarlos</h2>
          </div>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Análisis descriptivo basado en los registros disponibles</span>
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

      <section className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">Explorador de infraestructura</p><h2 className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-50">Parque generador y almacenamiento</h2></div>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">{plantList.totalCount.toLocaleString("es-CL")} activos en la vista</span>
        </div>

        <Panel className="flex flex-col gap-5 border-brand-primary/20 bg-white p-5 shadow-sm dark:border-brand-primary/15 dark:bg-neutral-950">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Filtra la infraestructura</h3><p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Combina tecnología, condición operativa y búsqueda por central o propietario.</p></div>{hasFilter && <Link href="/mercado" className="text-sm font-medium text-neutral-600 underline underline-offset-2 hover:text-brand-primary dark:text-neutral-300">Restablecer filtros</Link>}</div>
          <SearchBar basePath="/mercado" value={search} otherParams={{ tech: params.tech }} placeholder="Buscar por nombre de central o propietario...">
            <select
              name="estado"
              defaultValue={params.estado ?? ""}
              className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
            >
              <option value="">Todos los estados</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </SearchBar>
          <TechChipFilter
            basePath="/mercado"
            selectedKeys={selectedKeys}
            otherParams={{ estado: params.estado, q: search }}
            excludeKeys={["data-center", "transmision", "bess", "hibridos"]}
          />
          {activeFilterLabels.length > 0 && <p className="border-t border-neutral-200 pt-3 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-300"><span className="font-medium">Vista actual:</span> {activeFilterLabels.join(" · ")}</p>}
        </Panel>

        <Panel className="flex flex-col gap-4 overflow-hidden p-0">
          <p className="px-5 pt-5 text-sm text-neutral-600 dark:text-neutral-400">
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
            {plantList.totalCount.toLocaleString("es-CL")} centrales
            </span>
            {hasFilter ? " con este filtro" : ""}
            {" · "}
            {(stats.operatingCapacityMw / 1000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} GW operativos en
            total{hasFilter ? " (sin aplicar el filtro)" : ""} — fuente: Comisión Nacional de Energía (CNE).
          </p>
          <div className="border-t border-neutral-100 dark:border-neutral-800"><PowerPlantTable items={plantList.items} /></div>
          <div className="px-5 pb-5"><Pager page={page} totalPages={totalPages} buildHref={(p) => buildHref(params, { page: String(p) })} /></div>
        </Panel>
      </section>

      <AnalysisDrawer title="Análisis detallado de infraestructura" description="Compara tecnologías, regiones, propietarios y etapas para profundizar en la estructura del sistema.">
        <div className="rounded-2xl border border-brand-primary/25 bg-brand-surface p-5 dark:bg-brand-primary/10">
          <p className="text-xs font-semibold tracking-wide text-brand-deep uppercase dark:text-brand-primary">Cómo leer este análisis</p>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">Comienza por las conclusiones principales; luego contrasta construcción y BESS, revisa el cambio tecnológico por etapa y termina con la concentración regional y empresarial.</p>
        </div>
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Insights de mercado</h2>
          <MarketSnapshotList insights={marketInsights} />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Construcción</h2>
          <p className="-mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Declaración en Construcción de la Comisión Nacional de Energía (CNE) — incluye generación, almacenamiento
            (BESS) y transmisión.
          </p>
          <Panel className="flex flex-col gap-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {constructionStats.count.toLocaleString("es-CL")} proyectos ·{" "}
              {Math.round(constructionStats.totalPotenciaMw).toLocaleString("es-CL")} MW ·{" "}
              {constructionStats.bessCount.toLocaleString("es-CL")} con BESS
            </p>
          </Panel>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Almacenamiento BESS</h2>
          <p className="-mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Proyectos en construcción con batería: BESS independiente o incorporado a otra central (indicador +). Fuente:
            Declaración en Construcción de la CNE — el registro de centrales operativas no distingue esto todavía.
          </p>
          <Panel className="flex flex-col gap-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {bessProjects.length.toLocaleString("es-CL")} proyectos · {Math.round(bessTotalMw).toLocaleString("es-CL")} MW
            </p>
            <ConstructionProjectTable items={bessProjects} />
          </Panel>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Tecnologías</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <Panel>
              <h3 className="mb-4 text-lg font-medium text-neutral-900 dark:text-neutral-50">Potencia instalada por tecnología</h3>
              <BarList
                items={stats.byTechnology.map((t) => ({
                  label: t.technology,
                  value: Math.round(t.capacityMw),
                  secondaryValue: "MW",
                  techCategory: operationPlantTypeToCategory(t.technology) ?? undefined,
                }))}
                categorical
              />
            </Panel>
            <Panel>
              <h3 className="mb-4 text-lg font-medium text-neutral-900 dark:text-neutral-50">Por estado</h3>
              <BarList
                items={stats.byStatus.map((s) => ({
                  label: s.status,
                  value: Math.round(s.capacityMw),
                  secondaryValue: `MW · ${s.count.toLocaleString("es-CL")} centrales`,
                }))}
              />
            </Panel>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">¿Dónde está el mercado?</h2>
          <p className="-mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Tecnología × Etapa, en MW — Operación, Construcción y Pipeline lado a lado.
          </p>
          <Panel>
            <TechStageHeatmap categories={[...MARKET_TECH_CATEGORIES]} columns={heatmapColumns} />
          </Panel>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Regiones</h2>
          <Panel>
            <h3 className="mb-1 text-lg font-medium text-neutral-900 dark:text-neutral-50">
              {topRegion
                ? `${topRegion.region} concentra la mayor capacidad instalada (${Math.round(topRegion.capacityMw).toLocaleString("es-CL")} MW), liderada por ${topRegion.dominantTechnology.toLowerCase()}`
                : "Capacidad instalada por región"}
            </h3>
            <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
              Cruce de cuatro variables por región: cantidad de centrales (eje X), capacidad promedio por central
              (eje Y), capacidad total (tamaño de burbuja) y tecnología dominante (color).
            </p>
            <BubbleChart points={regionBubbles} />
          </Panel>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Propietarios y concentración</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <Panel>
              <h3 className="mb-4 text-lg font-medium text-neutral-900 dark:text-neutral-50">
                {stats.topOwners[0]?.owner ?? "El líder"} concentra el {topOwnerShare.toFixed(1)}% de la capacidad
                operativa del país
              </h3>
              <BarList
                items={stats.topOwners.map((o) => ({
                  label: o.owner,
                  value: Math.round(o.capacityMw),
                  secondaryValue: `MW · ${o.plantCount.toLocaleString("es-CL")} centrales`,
                }))}
                categorical
              />
            </Panel>
            <Panel>
              <h3 className="mb-4 text-lg font-medium text-neutral-900 dark:text-neutral-50">
                Índice de concentración del mercado (HHI)
              </h3>
              <IndexTile
                label="HHI por capacidad instalada"
                value={stats.marketConcentrationIndex}
                description="Índice Herfindahl-Hirschman (0-10000): suma de las cuotas de mercado al cuadrado de cada propietario. <1.500 baja concentración, 1.500-2.500 moderada, >2.500 alta — umbrales estándar de análisis de competencia."
              />
            </Panel>
          </div>
        </section>
      </AnalysisDrawer>
    </div>
  );
}
