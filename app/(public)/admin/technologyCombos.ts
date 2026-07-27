export type TechnologyCombo =
  | "solar"
  | "wind"
  | "hydro"
  | "bess"
  | "solar_bess"
  | "wind_bess"
  | "hydro_bess"
  | "solar_wind"
  | "hybrid_other";

export interface TechnologyComboConfig {
  label: string;
  /** Code de la tabla `technology` (ver lib/data-access/projects.ts resolveTechnologyIds). */
  technologyCode: string;
  includesStorage: boolean;
  projectKind: string;
}

/**
 * Un solo selector fija tecnología + includes_storage + project_kind a la vez — son las
 * tres columnas que determinan qué celdas de capacidad tienen sentido mostrar (ver
 * ProjectEditForm). "Solar + Eólico" y "Otro / Híbrido genérico" caen en el mismo
 * technology_id (Híbrido): la tabla `technology` no tiene una fila dedicada para esa
 * combinación específica, mismo criterio que ya usa el clasificador de ingesta
 * (lib/ingestion/classification/classifyTechnologyByName.ts) para nombres con dos
 * tecnologías distintas.
 */
export const TECHNOLOGY_COMBOS: Record<TechnologyCombo, TechnologyComboConfig> = {
  solar: { label: "Solar", technologyCode: "solar_pv", includesStorage: false, projectKind: "generation" },
  wind: { label: "Eólico", technologyCode: "wind", includesStorage: false, projectKind: "generation" },
  hydro: { label: "Hidroeléctrica", technologyCode: "hydro", includesStorage: false, projectKind: "generation" },
  bess: { label: "BESS", technologyCode: "bess", includesStorage: true, projectKind: "storage" },
  solar_bess: { label: "Solar + BESS", technologyCode: "solar_pv", includesStorage: true, projectKind: "hybrid" },
  wind_bess: { label: "Eólico + BESS", technologyCode: "wind", includesStorage: true, projectKind: "hybrid" },
  hydro_bess: { label: "Hidroeléctrica + BESS", technologyCode: "hydro", includesStorage: true, projectKind: "hybrid" },
  solar_wind: { label: "Solar + Eólico", technologyCode: "hybrid", includesStorage: false, projectKind: "hybrid" },
  hybrid_other: { label: "Otro / Híbrido genérico", technologyCode: "hybrid", includesStorage: false, projectKind: "hybrid" },
};

export const TECHNOLOGY_COMBO_ORDER: TechnologyCombo[] = [
  "solar",
  "wind",
  "hydro",
  "bess",
  "solar_bess",
  "wind_bess",
  "hydro_bess",
  "solar_wind",
  "hybrid_other",
];

/**
 * Reconstruye qué combo representa el estado actual del proyecto, para preseleccionar el
 * select. Devuelve null cuando no hay un mapeo confiable — tecnología distinta a
 * solar/eólico/bess/híbrido (hidro, térmica, biomasa, geotérmica, consumo, transmisión), o
 * "híbrido" con storage (no se puede distinguir de cuál de las dos combinaciones vino) — en
 * esos casos el select queda en "Sin definir" y no toca nada hasta que el admin elija algo.
 */
export function comboFromProject(technologyCode: string | null, includesStorage: boolean): TechnologyCombo | null {
  if (technologyCode === "bess") return "bess";
  if (technologyCode === "solar_pv") return includesStorage ? "solar_bess" : "solar";
  if (technologyCode === "wind") return includesStorage ? "wind_bess" : "wind";
  if (technologyCode === "hydro") return includesStorage ? "hydro_bess" : "hydro";
  return null;
}
