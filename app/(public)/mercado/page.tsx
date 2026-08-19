import type { Metadata } from "next";
import Link from "next/link";
import { Filter, MapPinned } from "lucide-react";
import { createSupabasePageClient } from "@/lib/data-access/supabase-page-client";
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
import { SectionHero } from "../components/SectionHero";

export const metadata: Metadata = { title: "Mercado — Transition LATAM" };
export const dynamic = "force-dynamic";

const STATUS_OPTIONS = ["Operativa", "En Construcción", "Fuera de Servicio"];
const PAGE_SIZE = 10;
const CONSTRUCTION_PAGE_SIZE = 10;

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
  return query ? `/operacion?${query}` : "/operacion";
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

  const client = await createSupabasePageClient();

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
    <div className="flex flex-col gap-6 pb-4">
      <SectionHero
        eyebrow="Inteligencia operativa"
        title="Proyectos en Operación"
        description="Revise la matriz eléctrica que ya está funcionando: capacidad instalada, propietarios, concentración y las obras que se van sumando."
        actions={
          <>
            <Link href="#lista-operacion" className="inline-flex items-center gap-2 rounded-lg border border-white/18 bg-white/5 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-white/10"><Filter size={15} /> Filtrar activos</Link>
            <Link href="#mapa-operacion" className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-3.5 py-2 text-sm font-semibold text-[#052020] transition hover:bg-[#63e3d4]"><MapPinned size={15} /> Ver mapa</Link>
          </>
        }
        metrics={[
          { label: "Capacidad operativa", value: compactMw(stats.operatingCapacityMw), detail: `${stats.totalPlants.toLocaleString("es-CL")} centrales registradas` },
          { label: "En construcción", value: compactMw(constructionStats.totalPotenciaMw), detail: `${constructionStats.count.toLocaleString("es-CL")} proyectos declarados` },
          { label: "BESS en construcción", value: compactMw(bessTotalMw), detail: `${bessProjects.length.toLocaleString("es-CL")} proyectos con baterías` },
          { label: "Principal operador", value: topOwner?.owner ?? "Sin dato", detail: topOwner ? `${topOwnerShare.toFixed(1)}% de la capacidad` : "sin concentración calculable" },
        ]}
      />

      {false && <ModuleGuide
        purpose="Entender cómo está compuesta hoy la matriz eléctrica chilena y cómo cambia al incorporar centrales en construcción y proyectos futuros."
        deliverables={["Capacidad y centrales por tecnología y región", "Principales propietarios y concentración", "Comparación entre operación, construcción y pipeline"]}
        howToUse={["Filtre por tecnología o estado", "Compare la capacidad instalada y futura", "Identifique brechas, concentración y crecimiento"]}
        plan="Free"
        upgradeMessage="Free entrega el panorama de mercado; Prime agrega profundidad por proyecto, análisis y seguimiento."
      />}

      {/* Las tres tarjetas de "Datos del sistema eléctrico nacional" repetían
          exactamente los tres primeros indicadores de la cabecera (capacidad
          operativa, en construcción y BESS en construcción). Se eliminaron; lo
          único que no estaba duplicado era la fecha de corte de la fuente, que
          se conserva acá. */}
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {capacitySourceDate
          ? `Capacidad instalada actualizada al ${new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${capacitySourceDate}T00:00:00Z`))}. Fuente: Comisión Nacional de Energía (CNE).`
          : "Fuente: Comisión Nacional de Energía (CNE)."}
      </p>

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
        <section id="mapa-operacion" className="flex flex-col gap-4" aria-labelledby="operating-map-title">
          <div>
            <h2 id="operating-map-title" className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Mapa de proyectos</h2>
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

      <section id="lista-operacion" className="order-last flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Proyectos en Operación</h2>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">{plantList.totalCount.toLocaleString("es-CL")} activos en la vista</span>
        </div>

        <Panel className="flex flex-col gap-5 border-brand-primary/20 bg-white p-5 shadow-sm dark:border-brand-primary/15 dark:bg-neutral-950">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Filtre la infraestructura</h3><p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Combine tecnología, condición operativa y búsqueda por central o propietario.</p></div>{hasFilter && <Link href="/operacion" className="text-sm font-medium text-neutral-600 underline underline-offset-2 hover:text-brand-primary dark:text-neutral-300">Restablecer filtros</Link>}</div>
          <SearchBar basePath="/operacion" value={search} otherParams={{ tech: params.tech }} placeholder="Buscar por nombre de central o propietario...">
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
            basePath="/operacion"
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
