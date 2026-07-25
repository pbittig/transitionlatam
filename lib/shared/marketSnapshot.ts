/**
 * Agregaciones para el "Market Snapshot" del dashboard — todas puras (sin
 * I/O), calculadas en Node sobre el mismo insumo ya usado por el resto de la
 * capa de inteligencia del pipeline (ScheduleForecastInput, ~750 filas bajo el
 * tope de PostgREST). Nada aquí inventa datos: cada insight se apoya en un
 * número ya calculado en otro lado (antigüedad real, COD outlook, calendario
 * de hitos) — donde no hay dato real para sostener una afirmación (ej.
 * "creciendo" sin serie de tiempo), no se genera el insight.
 */

import type { ConnectionCalendarEntry, RequestAgeBenchmarks, ScheduleForecastInput } from "@/lib/data-access/pipeline";
import { computeCodOutlook } from "./projectIntelligence";
import { pipelineTechCodeToCategory, type MarketTechCategory } from "./marketTechCategories";
import type { MilestoneCalendar, MilestoneMonthEntry } from "./scheduleForecast";

export interface PipelineTotals {
  count: number;
  totalCapacityMw: number;
}

export function computePipelineTotals(inputs: ScheduleForecastInput[]): PipelineTotals {
  return { count: inputs.length, totalCapacityMw: inputs.reduce((sum, i) => sum + (i.capacityMw ?? 0), 0) };
}

export interface TechCapacity {
  category: MarketTechCategory;
  capacityMw: number;
  count: number;
}

export function computePipelineByTechnology(inputs: ScheduleForecastInput[]): TechCapacity[] {
  const map = new Map<MarketTechCategory, TechCapacity>();
  for (const i of inputs) {
    const category = pipelineTechCodeToCategory(i.technologyCode);
    if (!category) continue;
    const cur = map.get(category) ?? { category, capacityMw: 0, count: 0 };
    cur.capacityMw += i.capacityMw ?? 0;
    cur.count += 1;
    map.set(category, cur);
  }
  return [...map.values()].sort((a, b) => b.capacityMw - a.capacityMw);
}

export interface RegionCapacity {
  region: string;
  capacityMw: number;
  count: number;
}

export function computePipelineByRegion(inputs: ScheduleForecastInput[]): RegionCapacity[] {
  const map = new Map<string, RegionCapacity>();
  for (const i of inputs) {
    if (!i.region) continue;
    const cur = map.get(i.region) ?? { region: i.region, capacityMw: 0, count: 0 };
    cur.capacityMw += i.capacityMw ?? 0;
    cur.count += 1;
    map.set(i.region, cur);
  }
  return [...map.values()].sort((a, b) => b.capacityMw - a.capacityMw);
}

export interface PipelineHealthDistribution {
  total: number;
  alta: number;
  altaPct: number;
  media: number;
  mediaPct: number;
  baja: number;
  bajaPct: number;
}

/** Distribución de proyectos vigentes por banda de "Probabilidad de cumplir COD" — reusa exactamente el mismo cálculo que la ficha individual. */
export function computePipelineHealth(
  inputs: ScheduleForecastInput[],
  seiaStatusByProjectId: Map<string, string | null>,
  today: Date = new Date(),
): PipelineHealthDistribution {
  let alta = 0;
  let media = 0;
  let baja = 0;
  let total = 0;
  for (const i of inputs) {
    const outlook = computeCodOutlook(i.status, seiaStatusByProjectId.get(i.id) ?? null, i.estimatedConnectionDate, today);
    if (outlook.score === null) continue;
    total++;
    if (outlook.band === "alta") alta++;
    else if (outlook.band === "media") media++;
    else baja++;
  }
  return {
    total,
    alta,
    altaPct: total > 0 ? Math.round((alta / total) * 100) : 0,
    media,
    mediaPct: total > 0 ? Math.round((media / total) * 100) : 0,
    baja,
    bajaPct: total > 0 ? Math.round((baja / total) * 100) : 0,
  };
}

/** Año con más MW estimados entrando a Construcción — la "próxima ola" del pipeline. */
export function findNextConstructionWaveYear(constructionCalendar: MilestoneCalendar | undefined): number | null {
  if (!constructionCalendar || constructionCalendar.entries.length === 0) return null;
  const byYear = new Map<number, number>();
  for (const e of constructionCalendar.entries) {
    const year = Number(e.yearMonth.slice(0, 4));
    byYear.set(year, (byYear.get(year) ?? 0) + e.capacityMw);
  }
  let bestYear: number | null = null;
  let bestMw = -1;
  for (const [year, mw] of byYear) {
    if (mw > bestMw) {
      bestMw = mw;
      bestYear = year;
    }
  }
  return bestYear;
}

export function computeMarketSnapshotInsights(params: {
  pipelineTotals: PipelineTotals;
  byTechnology: TechCapacity[];
  byRegion: RegionCapacity[];
  ageBenchmarks: RequestAgeBenchmarks;
  constructionTotalMw: number;
  recentSolicitudes7d: number;
}): string[] {
  const insights: string[] = [];

  const topTech = params.byTechnology[0];
  if (topTech && params.pipelineTotals.totalCapacityMw > 0) {
    const pct = (topTech.capacityMw / params.pipelineTotals.totalCapacityMw) * 100;
    insights.push(`${pct.toFixed(0)}% del pipeline vigente (por MW) corresponde a ${topTech.category}.`);
  }

  const topRegion = params.byRegion[0];
  if (topRegion && params.pipelineTotals.totalCapacityMw > 0) {
    const pct = (topRegion.capacityMw / params.pipelineTotals.totalCapacityMw) * 100;
    insights.push(`${topRegion.region} concentra el ${pct.toFixed(0)}% de los MW en desarrollo del pipeline.`);
  }

  // Señal real de crecimiento reciente: menor antigüedad promedio = solicitudes
  // más nuevas en ese segmento (no una serie de tiempo, pero sí un dato real).
  const bessAge = params.ageBenchmarks.byTechnology.find((r) => /almacenamiento|bess/i.test(r.label));
  const otherAges = params.ageBenchmarks.byTechnology.filter((r) => r !== bessAge);
  if (bessAge && otherAges.length > 0 && bessAge.avgAgeMonths < Math.min(...otherAges.map((r) => r.avgAgeMonths))) {
    insights.push(
      `${bessAge.label} tiene la antigüedad promedio más baja de solicitud (${bessAge.avgAgeMonths} meses) — el segmento con incorporación más reciente al pipeline.`,
    );
  }

  if (params.constructionTotalMw > 0) {
    insights.push(`${Math.round(params.constructionTotalMw).toLocaleString("es-CL")} MW están actualmente en construcción.`);
  }

  if (params.recentSolicitudes7d > 0) {
    insights.push(
      `${params.recentSolicitudes7d} proyecto${params.recentSolicitudes7d === 1 ? "" : "s"} ingresaron al Coordinador en los últimos 7 días.`,
    );
  }

  return insights;
}

function quarterLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const quarter = Math.floor((month - 1) / 3) + 1;
  return `Q${quarter} ${year}`;
}

function topQuarter(entries: MilestoneMonthEntry[]): { label: string; capacityMw: number } | null {
  if (entries.length === 0) return null;
  const byQuarter = new Map<string, number>();
  for (const e of entries) {
    const q = quarterLabel(e.yearMonth);
    byQuarter.set(q, (byQuarter.get(q) ?? 0) + e.capacityMw);
  }
  let bestLabel: string | null = null;
  let bestMw = -1;
  for (const [label, mw] of byQuarter) {
    if (mw > bestMw) {
      bestMw = mw;
      bestLabel = label;
    }
  }
  return bestLabel ? { label: bestLabel, capacityMw: bestMw } : null;
}

export interface MarketCalendarHighlight {
  quarter: string;
  capacityMw: number;
  description: string;
}

/** El trimestre de mayor MW para cada hito (Compras, Construcción, Conexión) — la "historia" del calendario, no solo una lista de meses. */
export function computeMarketCalendarHighlights(
  milestoneCalendars: MilestoneCalendar[],
  connectionCalendar: ConnectionCalendarEntry[],
): MarketCalendarHighlight[] {
  const highlights: MarketCalendarHighlight[] = [];

  for (const mc of milestoneCalendars) {
    if (mc.phase === "basica") continue; // menos accionable para esta narrativa que Compras/Construcción
    const top = topQuarter(mc.entries);
    if (!top) continue;
    const verb = mc.phase === "compras" ? "entran en Compras" : "inician Construcción";
    highlights.push({ quarter: top.label, capacityMw: top.capacityMw, description: `${Math.round(top.capacityMw).toLocaleString("es-CL")} MW ${verb}` });
  }

  const topConnection = topQuarter(connectionCalendar.map((e) => ({ yearMonth: e.yearMonth, capacityMw: e.capacityMw, count: e.count })));
  if (topConnection) {
    highlights.push({
      quarter: topConnection.label,
      capacityMw: topConnection.capacityMw,
      description: `${Math.round(topConnection.capacityMw).toLocaleString("es-CL")} MW conectan`,
    });
  }

  return highlights.sort((a, b) => a.quarter.localeCompare(b.quarter));
}

export function computeMarketNarrative(params: {
  byTechnology: TechCapacity[];
  byRegion: RegionCapacity[];
  nextWaveYear: number | null;
}): string {
  const [topTech, secondTech] = params.byTechnology;
  const topRegions = params.byRegion.slice(0, 2).map((r) => r.region);
  const parts: string[] = [];

  if (topTech) {
    parts.push(`El pipeline vigente está liderado por proyectos de ${topTech.category}${secondTech ? `, seguido por ${secondTech.category}` : ""}.`);
  }
  if (topRegions.length > 0) {
    parts.push(`La mayor actividad se concentra en ${topRegions.join(" y ")}.`);
  }
  if (params.nextWaveYear) {
    parts.push(`Estimamos una ventana de construcción especialmente intensa hacia ${params.nextWaveYear}.`);
  }

  return parts.join(" ");
}
