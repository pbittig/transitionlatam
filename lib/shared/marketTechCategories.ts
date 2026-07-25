/**
 * Categorías canónicas de tecnología para comparar Operación (power_plant),
 * Construcción (construction_project) y Pipeline (project) lado a lado — cada
 * fuente usa su propia nomenclatura (plant_type, tipo_tecnologia_final,
 * technology.code respectivamente), así que hace falta normalizar a un mismo
 * conjunto de filas para poder cruzarlas en un heatmap.
 */

export const MARKET_TECH_CATEGORIES = ["Solar", "Eólico", "BESS", "Hidro", "Térmica", "Geotérmica", "Híbrido"] as const;
export type MarketTechCategory = (typeof MARKET_TECH_CATEGORIES)[number];

/** power_plant.plant_type (ver PLANT_TYPE_MAP en scripts/sync-cne-capacidad.ts) → categoría canónica. */
export function operationPlantTypeToCategory(plantType: string | null): MarketTechCategory | null {
  switch (plantType) {
    case "Solares":
      return "Solar";
    case "Eólicas":
      return "Eólico";
    case "Hidroeléctricas":
      return "Hidro";
    case "Geotérmica":
      return "Geotérmica";
    case "Termoeléctricas":
      return "Térmica";
    default:
      return null;
  }
}

/** construction_project.tipo_tecnologia_final (texto libre del Excel CNE) → categoría canónica. */
export function constructionTechToCategory(tipoTecnologiaFinal: string | null): MarketTechCategory | null {
  if (!tipoTecnologiaFinal) return null;
  const t = tipoTecnologiaFinal.toLowerCase();
  if (t.includes("solar")) return "Solar";
  if (t.includes("eólic") || t.includes("eolic")) return "Eólico";
  if (t.includes("hidr")) return "Hidro";
  if (t.includes("bess") || t.includes("batería") || t.includes("bateria")) return "BESS";
  if (t.includes("geotérmic") || t.includes("geotermic")) return "Geotérmica";
  if (t.includes("petróleo") || t.includes("petroleo") || t.includes("gnl") || t.includes("diésel") || t.includes("diesel") || t.includes("biomasa")) {
    return "Térmica";
  }
  return null;
}

/** project.technology.code (pipeline) → categoría canónica. */
export function pipelineTechCodeToCategory(code: string | null): MarketTechCategory | null {
  switch (code) {
    case "solar_pv":
      return "Solar";
    case "wind":
      return "Eólico";
    case "bess":
      return "BESS";
    case "hybrid":
      return "Híbrido";
    case "hydro":
    case "pumped_hydro":
      return "Hidro";
    case "thermal":
    case "biomass":
      return "Térmica";
    case "geothermal":
      return "Geotérmica";
    default:
      return null; // consumption/transmission ya están ocultos por RLS
  }
}
