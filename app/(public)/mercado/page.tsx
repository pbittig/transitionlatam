import type { Metadata } from "next";
import Link from "next/link";
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

  return (
    <div className="flex flex-col gap-10">
      <section className="border-b border-neutral-200 pb-7 dark:border-neutral-800">
        <p className="text-xs font-medium tracking-[0.14em] text-neutral-500 uppercase dark:text-neutral-400">Panorama de mercado · infraestructura energética</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl dark:text-neutral-50">Infraestructura del sistema</h1>
        <p className="mt-2 max-w-2xl text-neutral-600 dark:text-neutral-400">
          Lee el sistema como una sola cartera: infraestructura operativa, obras en construcción y la capacidad que busca conexión. Fuentes: CNE y Coordinador Eléctrico Nacional.
        </p>
      </section>

      <section className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">Explorador de infraestructura</p><h2 className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-50">Parque generador y almacenamiento</h2></div>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">{plantList.totalCount.toLocaleString("es-CL")} activos en la vista</span>
        </div>

        <Panel className="flex flex-col gap-5 border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-950">
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

        <Panel className="flex flex-col gap-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {plantList.totalCount.toLocaleString("es-CL")} centrales
            {hasFilter ? " con este filtro" : ""}
            {" · "}
            {(stats.operatingCapacityMw / 1000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} GW operativos en
            total{hasFilter ? " (sin aplicar el filtro)" : ""} — fuente: Comisión Nacional de Energía (CNE).
          </p>
          <PowerPlantTable items={plantList.items} />
          <Pager page={page} totalPages={totalPages} buildHref={(p) => buildHref(params, { page: String(p) })} />
        </Panel>
      </section>

      <AnalysisDrawer title="Análisis de infraestructura" description="Profundiza en las tecnologías, regiones, propietarios y etapas que explican el sistema.">
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
            Proyectos en construcción con batería: BESS standalone o incorporado a otra central (columna "+"). Fuente:
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
