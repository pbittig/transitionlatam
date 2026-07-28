// Chips de tecnología compartidos entre "Proyectos Actuales" y "Proyectos Esperados".
export interface TechChipConfig {
  key: string;
  label: string;
  technologyCodes?: string[]; // pipeline (project.technology.code) y operativos (mapeado a plantType aparte)
  plantTypes?: string[]; // operativos (power_plant.plant_type)
  namePatterns?: string[]; // heurística por nombre cuando no hay campo estructurado
}

export const TECH_CHIPS: TechChipConfig[] = [
  { key: "solar", label: "Solar", technologyCodes: ["solar_pv"], plantTypes: ["Solares"] },
  { key: "eolico", label: "Eólico", technologyCodes: ["wind"], plantTypes: ["Eólicas"] },
  { key: "hidro", label: "Hidroeléctrica", technologyCodes: ["hydro", "pumped_hydro"], plantTypes: ["Hidroeléctricas"] },
  { key: "termica", label: "Térmica", technologyCodes: ["thermal"], plantTypes: ["Termoeléctricas"] },
  { key: "bess", label: "BESS", technologyCodes: ["bess"], namePatterns: ["bess", "batería", "almacenamiento", "sae"] },
  { key: "hibridos", label: "Híbridos", technologyCodes: ["hybrid"] },
  {
    key: "transmision",
    label: "Transmisión y Distribución",
    technologyCodes: ["transmission"],
    // La mayoría de los proyectos de subestaciones/líneas/alimentadores NO están
    // etiquetados con technology_id='transmission' en el pipeline (solo 13 lo
    // tienen) — el nombre es la única señal real para el resto (342 proyectos
    // detectados por patrón, ver hallazgo real al construir esta sección).
    namePatterns: [
      "subestación",
      "subestacion",
      "línea de transmisión",
      "linea de transmision",
      "alimentador",
      "seccionador",
      "seccionamiento",
      "transformador",
    ],
  },
  { key: "data-center", label: "Data Center", namePatterns: ["data center", "datacenter", "centro de datos"] },
];

export function chipsToTechnologyCodes(keys: string[]): string[] {
  return TECH_CHIPS.filter((c) => keys.includes(c.key)).flatMap((c) => c.technologyCodes ?? []);
}

export function chipsToPlantTypes(keys: string[]): string[] {
  return TECH_CHIPS.filter((c) => keys.includes(c.key)).flatMap((c) => c.plantTypes ?? []);
}

export function chipsToNamePatterns(keys: string[]): string[] {
  return TECH_CHIPS.filter((c) => keys.includes(c.key)).flatMap((c) => c.namePatterns ?? []);
}

/** Misma nomenclatura que la barra de chips de tecnología, para una ficha de proyecto puntual — primer chip cuyo technologyCode o patrón de nombre matchea. */
export function chipLabelForProject(technologyCode: string | null, name: string): string {
  const normalizedName = name.toLowerCase();
  const chip = TECH_CHIPS.find(
    (c) =>
      (technologyCode && c.technologyCodes?.includes(technologyCode)) ||
      c.namePatterns?.some((p) => normalizedName.includes(p)),
  );
  return chip?.label ?? "Sin clasificar";
}

export function parseChipKeys(param: string | undefined): string[] {
  if (!param) return [];
  return param
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
