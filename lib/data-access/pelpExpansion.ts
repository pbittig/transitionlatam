import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Acceso a la expansión modelada de PELP.
 *
 * Todo se consulta SIEMPRE acotado a un escenario. Los cinco escenarios de PELP
 * son futuros alternativos, no partes de un total: sumarlos daría ~207 GW
 * solares, una cifra que no ocurre en ninguno de ellos. Por eso no existe acá
 * ninguna función que agregue sin `scenarioId`.
 */

export interface PelpScenario {
  scenarioId: string;
  scenarioName: string;
  demandScenario: string | null;
}

export interface PelpExpansionRow {
  assetNameRaw: string;
  technologyRaw: string;
  technologyCode: string;
  nodeRaw: string;
  year: number;
  capacityMw: number;
  capacityCumulativeMw: number;
  durationHours: number | null;
  /**
   * Energía derivada (MW × horas), NO entregada por PELP.
   *
   * `capacity_expansion_MWh` viene vacío en el 100% de las filas del reporte, así
   * que la energía se calcula. La duración es dato de la fuente, no un supuesto:
   * sale de `max_hours` del diccionario de almacenamiento, y se validó contra la
   * convención de nombres del propio modelo — los 69 activos BESS codifican sus
   * horas en el nombre (`BESS_Itahue220_8h`) y coinciden con `max_hours` en los
   * 69 casos, sin una sola discrepancia.
   *
   * Se calcula al leer y no se guarda en la tabla, para que
   * `capacity_expansion_mwh` siga reflejando exactamente lo que entregó la
   * fuente (vacío) y no se confunda un cálculo nuestro con un dato oficial.
   * Debe mostrarse siempre rotulado como derivado.
   */
  energyMwhDerived: number | null;
  regionRaw: string | null;
  comunaRaw: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** Categorías canónicas de la paleta de marca (ver lib/shared/chartColors.ts). */
export function techCategoryFor(technologyCode: string): string {
  switch (technologyCode) {
    case "solar_PV":
      return "Solar";
    case "onshore_wind":
    case "offshore_wind":
      return "Eólico";
    case "BESS":
      return "BESS";
    default:
      return "Otros";
  }
}

/**
 * Offshore comparte categoría de marca con onshore (ambas son eólicas y deben
 * leerse como tal), pero la visualización oficial del ministerio las separa y
 * conviene poder distinguirlas: en E3 y N2 el offshore aparece y en los otros
 * tres escenarios no, que es justamente el hallazgo interesante.
 *
 * Se resuelve con un paso más claro del MISMO verde, no con un color nuevo: la
 * skill de dataviz prohíbe generar una hue adicional, pero un escalón dentro de
 * una familia ya validada es la forma estándar de separar dos miembros de la
 * misma categoría.
 */
export const OFFSHORE_WIND_TINT = { light: "#4fb84f", dark: "#5cc95c" };

export function techLabelFor(technologyCode: string, locale: "es" | "en"): string {
  const es: Record<string, string> = {
    solar_PV: "Solar fotovoltaica",
    onshore_wind: "Eólica onshore",
    offshore_wind: "Eólica offshore",
    BESS: "Almacenamiento BESS",
    geothermal: "Geotérmica",
    other: "Otras",
  };
  const en: Record<string, string> = {
    solar_PV: "Solar PV",
    onshore_wind: "Onshore wind",
    offshore_wind: "Offshore wind",
    BESS: "BESS storage",
    geothermal: "Geothermal",
    other: "Other",
  };
  return (locale === "en" ? en : es)[technologyCode] ?? technologyCode;
}

export async function getPelpScenarios(client: SupabaseClient): Promise<PelpScenario[]> {
  const { data } = await client
    .from("pelp_scenario")
    .select("scenario_id, scenario_name, demand_scenario")
    .order("scenario_id");
  return (data ?? []).map((r) => ({
    scenarioId: r.scenario_id as string,
    scenarioName: r.scenario_name as string,
    demandScenario: (r.demand_scenario as string | null) ?? null,
  }));
}

/**
 * Trae las filas de un escenario. Son ~3.100 por escenario, así que se agrega en
 * memoria en vez de mantener vistas materializadas que habría que refrescar en
 * cada sync mensual.
 */
export async function getPelpExpansionForScenario(
  client: SupabaseClient,
  scenarioId: string,
): Promise<PelpExpansionRow[]> {
  const { data, error } = await client
    .from("pelp_expansion")
    .select(
      "asset_name_raw, technology_raw, technology_code, node_raw, year, capacity_expansion_mw, capacity_expansion_cumulative_mw, duration_hours, region_raw, comuna_raw, latitude, longitude",
    )
    .eq("scenario_id", scenarioId)
    .order("year");
  if (error) throw new Error(`Error leyendo expansión PELP: ${error.message}`);
  return (data ?? []).map((r) => {
    const capacityMw = Number(r.capacity_expansion_mw ?? 0);
    const durationHours = r.duration_hours === null ? null : Number(r.duration_hours);
    return {
      assetNameRaw: r.asset_name_raw as string,
      technologyRaw: r.technology_raw as string,
      technologyCode: r.technology_code as string,
      nodeRaw: r.node_raw as string,
      year: Number(r.year),
      capacityMw,
      capacityCumulativeMw: Number(r.capacity_expansion_cumulative_mw ?? 0),
      durationHours,
      energyMwhDerived: durationHours === null ? null : capacityMw * durationHours,
      regionRaw: (r.region_raw as string | null) ?? null,
      comunaRaw: (r.comuna_raw as string | null) ?? null,
      latitude: r.latitude === null ? null : Number(r.latitude),
      longitude: r.longitude === null ? null : Number(r.longitude),
    };
  });
}

export interface PelpAggregates {
  totalMwByTech: Array<{ code: string; mw: number }>;
  mwByYearAndTech: Array<{ year: number; byTech: Record<string, number> }>;
  cumulativeByYearAndTech: Array<{ year: number; byTech: Record<string, number> }>;
  mwByRegion: Array<{ label: string; mw: number }>;
  mwByComuna: Array<{ label: string; mw: number }>;
  bessByNode: Array<{ label: string; mw: number }>;
  solarByRegion: Array<{ label: string; mw: number }>;
  windByRegion: Array<{ label: string; mw: number }>;
  years: number[];
  techCodes: string[];
  assetCount: number;
  nodeCount: number;
  comunaCount: number;
}

function topBy(rows: PelpExpansionRow[], key: (r: PelpExpansionRow) => string | null, limit = 8) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + r.capacityMw);
  }
  return [...m.entries()]
    .map(([label, mw]) => ({ label, mw }))
    .sort((a, b) => b.mw - a.mw)
    .slice(0, limit);
}

export function aggregatePelp(rows: PelpExpansionRow[]): PelpAggregates {
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b);
  const techCodes = [...new Set(rows.map((r) => r.technologyCode))].sort();

  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.technologyCode, (totals.get(r.technologyCode) ?? 0) + r.capacityMw);

  const byYear = years.map((year) => {
    const byTech: Record<string, number> = {};
    for (const code of techCodes) byTech[code] = 0;
    for (const r of rows) if (r.year === year) byTech[r.technologyCode] += r.capacityMw;
    return { year, byTech };
  });

  // Acumulado propio y no `capacity_expansion_cumulative_mw`: esa columna acumula
  // por activo, no por tecnología, y sumarla entre activos contaría de más.
  const running: Record<string, number> = {};
  for (const code of techCodes) running[code] = 0;
  const cumulative = byYear.map(({ year, byTech }) => {
    const snapshot: Record<string, number> = {};
    for (const code of techCodes) {
      running[code] += byTech[code] ?? 0;
      snapshot[code] = running[code];
    }
    return { year, byTech: snapshot };
  });

  const bess = rows.filter((r) => r.technologyCode === "BESS");
  const solar = rows.filter((r) => r.technologyCode === "solar_PV");
  const wind = rows.filter((r) => r.technologyCode === "onshore_wind" || r.technologyCode === "offshore_wind");

  return {
    totalMwByTech: [...totals.entries()].map(([code, mw]) => ({ code, mw })).sort((a, b) => b.mw - a.mw),
    mwByYearAndTech: byYear,
    cumulativeByYearAndTech: cumulative,
    mwByRegion: topBy(rows, (r) => r.regionRaw),
    mwByComuna: topBy(rows, (r) => r.comunaRaw),
    bessByNode: topBy(bess, (r) => r.nodeRaw),
    solarByRegion: topBy(solar, (r) => r.regionRaw),
    windByRegion: topBy(wind, (r) => r.regionRaw),
    years,
    techCodes,
    assetCount: new Set(rows.map((r) => r.assetNameRaw)).size,
    nodeCount: new Set(rows.map((r) => r.nodeRaw)).size,
    comunaCount: new Set(rows.map((r) => r.comunaRaw).filter(Boolean)).size,
  };
}
