import type { Metadata } from "next";
import Link from "next/link";
import { Activity, BatteryCharging, Building2 } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getLatestCapacitySourceDate, getPowerPlantRegionBubbles, getPowerPlantsForMap, getPowerPlantStats, listPowerPlants } from "@/lib/data-access/powerPlants";
import { getConstructionStats, getConstructionProjects } from "@/lib/data-access/construction";
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
import { OwnerCapacityDonut } from "../components/OwnerCapacityDonut";
import { TechnologyCapacityDonut } from "../components/TechnologyCapacityDonut";
import { ModuleGuide } from "../components/ModuleGuide";
import { MapView } from "../components/MapView";

export const metadata: Metadata = { title: "Mercado — Transition LATAM" };
export const dynamic = "force-dynamic";

const STATUS_OPTIONS = ["Operativa", "En Construcción", "Fuera de Servicio"];
const PAGE_SIZE = 10;
const CONSTRUCTION_PAGE_SIZE = 10;

function buildHref(params: Record<string, string | undefined>, overrides: Record<string, string | undefined>): string {
  const merged = { ...params, ...overrides };
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) qs.set(key, value);
  }
  const query = qs.toString();
  return query ? `/matriz?${query}` : "/matriz";
}

export default async function MercadoPage({
  searchParams,
}: {
  searchParams: Promise<{ tech?: string; estado?: string; page?: string; construccionPage?: string; q?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1") || 1;
  const constructionPage = Math.max(1, Number(params.construccionPage ?? "1") || 1);
  const selectedKeys = parseChipKeys(params.tech);
  const plantTypes = chipsToPlantTypes(selectedKeys);
  const namePatterns = chipsToNamePatterns(selectedKeys);
  const search = params.q;
  const hasFilter = plantTypes.length > 0 || namePatterns.length > 0 || !!params.estado || !!search;

  const client = await createSupabaseServerClient();

  const [stats, regionBubbles, plantList, operatingPlantsMap, capacitySourceDate, constructionStats, constructionProjects] = await Promise.all([
    getPowerPlantStats(client),
    getPowerPlantRegionBubbles(client),
    listPowerPlants(client, { status: params.estado, plantTypes, namePatterns, search }, page, PAGE_SIZE),
    getPowerPlantsForMap(client, { status: "Operativa" }),
    getLatestCapacitySourceDate(client),
    getConstructionStats(client),
    getConstructionProjects(client),
  ]);
  const totalPages = Math.max(1, Math.ceil(plantList.totalCount / plantList.pageSize));
  const constructionTotalPages = Math.max(1, Math.ceil(constructionProjects.length / CONSTRUCTION_PAGE_SIZE));
  const paginatedConstructionProjects = constructionProjects.slice(
    (constructionPage - 1) * CONSTRUCTION_PAGE_SIZE,
    constructionPage * CONSTRUCTION_PAGE_SIZE,
  );

  const topOwner = stats.topOwners[0];
  const topOwnerShare = topOwner && stats.operatingCapacityMw > 0 ? (topOwner.capacityMw / stats.operatingCapacityMw) * 100 : 0;
  const topRegion = [...regionBubbles].sort((a, b) => b.capacityMw - a.capacityMw)[0];

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
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-black via-[#272727] to-[#333333] px-6 py-8 text-white shadow-xl shadow-black/10 md:px-8 md:py-10">
        <span className="absolute -top-20 right-10 h-52 w-52 rounded-full border border-white/10" aria-hidden />
        <span className="absolute -right-10 -bottom-24 h-64 w-64 rounded-full bg-brand-primary/15 blur-2xl" aria-hidden />
        <div className="relative">
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Proyectos en Operación</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75 md:text-base">
          Revise la capacidad operativa del sistema, las obras en construcción y su composición tecnológica. Fuentes: CNE y Coordinador Eléctrico Nacional.
          </p>
        </div>
      </section>

      <ModuleGuide
        purpose="Entender cómo está compuesta hoy la matriz eléctrica chilena y cómo cambia al incorporar centrales en construcción y proyectos futuros."
        deliverables={["Capacidad y centrales por tecnología y región", "Principales propietarios y concentración", "Comparación entre operación, construcción y pipeline"]}
        howToUse={["Filtre por tecnología o estado", "Compare la capacidad instalada y futura", "Identifique brechas, concentración y crecimiento"]}
        plan="Free"
        upgradeMessage="Free entrega el panorama de mercado; Prime agrega profundidad por proyecto, análisis y seguimiento."
      />

      <section aria-labelledby="system-summary-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="system-summary-title" className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">Datos del sistema eléctrico nacional</h2>
          </div>
          <p className="max-w-md text-sm text-neutral-500 dark:text-neutral-400">
            {capacitySourceDate
              ? `Capacidad instalada actualizada al ${new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${capacitySourceDate}T00:00:00Z`))}. Fuente: CNE.`
              : "Fuente: Comisión Nacional de Energía (CNE)."}
          </p>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            { icon: Activity, label: "En operación · capacidad neta", value: `${Math.round(stats.operatingCapacityMw).toLocaleString("es-CL")} MW`, detail: `${stats.totalPlants.toLocaleString("es-CL")} centrales registradas`, iconClass: "bg-brand-surface text-brand-deep" },
            { icon: Building2, label: "En construcción · capacidad neta", value: `${Math.round(constructionStats.totalPotenciaMw).toLocaleString("es-CL")} MW`, detail: `${constructionStats.count.toLocaleString("es-CL")} proyectos declarados`, iconClass: "bg-brand-surface text-brand-deep" },
            { icon: BatteryCharging, label: "BESS en construcción · capacidad neta", value: `${Math.round(bessTotalMw).toLocaleString("es-CL")} MW`, detail: `${bessProjects.length.toLocaleString("es-CL")} proyectos con baterías`, iconClass: "bg-brand-surface text-brand-deep" },
          ].map(({ icon: Icon, label, value, detail, iconClass }) => (
            <article key={label} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
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

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Propietarios y concentración</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <Panel>
            <h3 className="mb-4 text-lg font-medium text-neutral-900 dark:text-neutral-50">
              {stats.topOwners[0]?.owner ?? "El líder"} concentra el {topOwnerShare.toFixed(1)}% de la capacidad operativa del país
            </h3>
            <OwnerCapacityDonut owners={stats.topOwners} totalCapacityMw={stats.operatingCapacityMw} />
          </Panel>
          <Panel>
            <h3 className="mb-4 text-lg font-medium text-neutral-900 dark:text-neutral-50">Índice de concentración del mercado (HHI)</h3>
            <IndexTile
              label="HHI por capacidad instalada"
              value={stats.marketConcentrationIndex}
              description="Índice Herfindahl-Hirschman (0-10000): suma de las cuotas de mercado al cuadrado de cada propietario. <1.500 baja concentración, 1.500-2.500 moderada, >2.500 alta — umbrales estándar de análisis de competencia."
            />
          </Panel>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Tecnologías</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <Panel>
            <h3 className="mb-4 text-lg font-medium text-neutral-900 dark:text-neutral-50">Potencia instalada por tecnología</h3>
            <TechnologyCapacityDonut technologies={stats.byTechnology} />
          </Panel>
          <Panel>
            <h3 className="mb-4 text-lg font-medium text-neutral-900 dark:text-neutral-50">Por estado</h3>
            <BarList
              items={stats.byStatus.map((status) => ({
                label: status.status,
                value: Math.round(status.capacityMw),
                secondaryValue: `MW · ${status.count.toLocaleString("es-CL")} centrales`,
              }))}
            />
          </Panel>
        </div>
      </section>

      {operatingPlantsMap.length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="operating-map-title">
          <div>
            <h2 id="operating-map-title" className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Mapa de proyectos en operación</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Ubicación de {operatingPlantsMap.length.toLocaleString("es-CL")} centrales operativas con coordenadas disponibles. Seleccione un punto para revisar su tecnología, capacidad y propietario.
            </p>
          </div>
          <MapView regionBubbles={[]} precisePoints={[]} powerPlants={operatingPlantsMap} />
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs leading-5 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
            <p className="font-semibold text-neutral-800 dark:text-neutral-200">Notas:</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>La capacidad instalada neta no considera los sistemas de «Los Lagos» (10,5 MW) e «Isla de Pascua» (8 MW).</li>
              <li>La central de Gas Natural localizada en Salta (Argentina), interconectada al SING (380 MW), no se considera.</li>
            </ol>
          </div>
        </section>
      )}

      <section className="order-last flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Proyectos en Operación</h2>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">{plantList.totalCount.toLocaleString("es-CL")} activos en la vista</span>
        </div>

        <Panel className="flex flex-col gap-5 border-brand-primary/20 bg-white p-5 shadow-sm dark:border-brand-primary/15 dark:bg-neutral-950">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Filtre la infraestructura</h3><p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Combine tecnología, condición operativa y búsqueda por central o propietario.</p></div>{hasFilter && <Link href="/matriz" className="text-sm font-medium text-neutral-600 underline underline-offset-2 hover:text-brand-primary dark:text-neutral-300">Restablecer filtros</Link>}</div>
          <SearchBar basePath="/matriz" value={search} otherParams={{ tech: params.tech }} placeholder="Buscar por nombre de central o propietario...">
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
            basePath="/matriz"
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

      <section className="flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Construcción</h2>
          <p className="-mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Declaración en Construcción de la Comisión Nacional de Energía (CNE) (incluye: Generación + Almacenamiento).
          </p>
          <Panel className="flex flex-col gap-4">
            <ConstructionProjectTable items={paginatedConstructionProjects} />
            <Pager
              page={constructionPage}
              totalPages={constructionTotalPages}
              buildHref={(nextPage) => buildHref(params, { construccionPage: String(nextPage) })}
            />
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

      </section>
    </div>
  );
}
