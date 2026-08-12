/**
 * Normalización de los valores de PELP.
 *
 * Regla que atraviesa todo el módulo: el valor original NUNCA se pierde. Cada
 * campo normalizado convive con su `*_raw`, porque PELP es una fuente de
 * modelamiento y cualquier interpretación nuestra tiene que poder auditarse
 * contra lo que entregó el ministerio.
 */
import type { PelpRow } from "./fetch";

/** Códigos internos nuestros. `technology_raw` conserva el carrier tal cual. */
export type PelpTechnologyCode = "solar_PV" | "onshore_wind" | "offshore_wind" | "BESS" | "geothermal" | "other";

/**
 * Los carriers observados el 2026-08-12 en la tabla de expansión son cinco:
 * solar PV, onshore wind, offshore wind, BESS y geothermal. El diccionario trae
 * 16, así que el mapeo se hace por patrón y no por lista cerrada: si PELP
 * incorpora hidrógeno o CSP en una versión futura, cae en "other" en vez de
 * romper la ingesta.
 */
export function normalizeTechnology(carrier: string | null): PelpTechnologyCode {
  const c = (carrier ?? "").toLowerCase().trim();
  if (!c) return "other";
  if (c.includes("offshore")) return "offshore_wind";
  if (c.includes("wind") || c.includes("eólic") || c.includes("eolic")) return "onshore_wind";
  if (c.includes("solar") || c === "pv" || c.includes("fotovolt")) return "solar_PV";
  if (c.includes("bess") || c.includes("batter") || c.includes("storage")) return "BESS";
  if (c.includes("geother")) return "geothermal";
  return "other";
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function toText(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

export interface NormalizedExpansion {
  scenarioId: string;
  assetNameRaw: string;
  technologyRaw: string;
  nodeRaw: string;
  year: number;
  assetType: string | null;
  technologyCode: PelpTechnologyCode;
  capacityExpansionMw: number | null;
  capacityExpansionCumulativeMw: number | null;
  capacityExpansionMwh: number | null;
  capacityExpansionCumulativeMwh: number | null;
  latitude: number | null;
  longitude: number | null;
  regionRaw: string | null;
  provinciaRaw: string | null;
  comunaRaw: string | null;
  rawRecord: PelpRow;
}

/**
 * Devuelve null cuando falta alguna parte de la clave lógica. En la extracción
 * del 2026-08-12 ninguna de las 15.600 filas cayó acá, pero descartar una fila
 * incompleta es preferible a insertarla con una clave que no identifica nada.
 */
export function normalizeExpansionRow(row: PelpRow): NormalizedExpansion | null {
  const scenarioId = toText(row["global_scenario"]);
  const assetNameRaw = toText(row["asset"]);
  const technologyRaw = toText(row["carrier"]);
  const nodeRaw = toText(row["bus"]);
  const year = toNumber(row["Año"]);
  if (!scenarioId || !assetNameRaw || !technologyRaw || !nodeRaw || year === null) return null;

  return {
    scenarioId,
    assetNameRaw,
    technologyRaw,
    nodeRaw,
    year: Math.round(year),
    assetType: toText(row["asset_type"]),
    technologyCode: normalizeTechnology(technologyRaw),
    capacityExpansionMw: toNumber(row["capacity_expansion_MW"]),
    capacityExpansionCumulativeMw: toNumber(row["capacity_expansion_cumulative_MW"]),
    capacityExpansionMwh: toNumber(row["capacity_expansion_MWh"]),
    capacityExpansionCumulativeMwh: toNumber(row["capacity_expansion_cumulative_MWh"]),
    latitude: toNumber(row["latitude"]),
    longitude: toNumber(row["longitude"]),
    regionRaw: toText(row["Región"]),
    provinciaRaw: toText(row["Provincia"]),
    comunaRaw: toText(row["Comuna"]),
    rawRecord: row,
  };
}

/**
 * Duración de las BESS. `capacity_expansion_MWh` viene 100% nulo en la tabla de
 * expansión, así que el único dato real de duración es `max_hours` del
 * diccionario de almacenamiento (poblado en 244 de 245 activos). Se une por
 * nombre exacto de activo; si no hay coincidencia devuelve null. NUNCA se
 * asume una duración por defecto: el brief lo pide explícitamente y además
 * inventarla contradiría la regla de no presentar una estimación como dato.
 */
export function durationHoursFor(
  assetName: string,
  storageByName: Map<string, { max_hours: number | null }>,
): number | null {
  const hit = storageByName.get(assetName);
  if (!hit || hit.max_hours === null) return null;
  // El optimizador entrega ruido de punto flotante (3.59999999712 por 3.6).
  return Math.round(hit.max_hours * 1000) / 1000;
}
