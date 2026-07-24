/**
 * Modelo probabilístico de cronograma de desarrollo — reemplaza el modelo de
 * duración fija anterior. Son supuestos de mercado (no un dato verificado por
 * proyecto), especificados por ONIX en julio 2026 a partir de experiencia real
 * de desarrollo, ingeniería y construcción de proyectos utility-scale y PMGD
 * en Chile. Se editan aquí, no en el código que los consume.
 *
 * Principios:
 * - Cada etapa tiene una duración (min/probable/max), no una fecha fija.
 * - Las etapas se superponen en la ejecución real (ej. Compras arranca antes
 *   de terminar la Ingeniería de Detalle) — el cálculo de fechas en
 *   computeEstimatedPhase.ts ya maneja esto (límites no decrecientes, ver
 *   PhaseTimeline.tsx), así que aquí solo se declara la duración de cada
 *   etapa, no su fecha de inicio.
 * - El rango min/max solo viene dado explícitamente para dos etapas
 *   (Construcción Solar, y Factibilidad/Construcción PMGD). Para el resto, el
 *   rango se deriva aplicando la misma proporción del ejemplo dado
 *   (Construcción Solar: min=10/14=71.4% del probable, max=18/14=128.6%) de
 *   forma uniforme — es una extrapolación declarada, no un dato adicional
 *   verificado por etapa.
 */

export interface DurationRange {
  min: number; // meses
  likely: number; // meses — valor "más probable"
  max: number; // meses
}

export type PhaseKey =
  | "campana_viento"
  | "desarrollo"
  | "conceptual"
  | "basica"
  | "detalle"
  | "compras"
  | "construccion"
  | "comisionamiento"
  | "factibilidad"
  | "pruebas";

export type ConfidenceLevel = "alta" | "media" | "baja";

export const PHASE_LABELS: Record<PhaseKey, string> = {
  campana_viento: "Campaña de Medición de Viento",
  desarrollo: "Desarrollo",
  conceptual: "Ingeniería Conceptual",
  basica: "Ingeniería Básica",
  detalle: "Ingeniería de Detalle",
  compras: "Compras",
  construccion: "Construcción",
  comisionamiento: "Comisionamiento",
  factibilidad: "Estudios de Factibilidad / Conexión",
  pruebas: "Pruebas y Puesta en Servicio",
};

// Agrupación de las 10 etapas del modelo en 5 "grandes etapas" para el filtro
// de Proyectos futuros — alguien buscando "algo temprano" o "un proyecto en
// compras" no conoce (ni necesita conocer) la jerga interna de 10 etapas.
export const PHASE_GROUPS = ["temprano", "ingenieria", "compras", "construccion", "comisionamiento"] as const;
export type PhaseGroup = (typeof PHASE_GROUPS)[number];

export const PHASE_GROUP_LABELS: Record<PhaseGroup, string> = {
  temprano: "Desarrollo temprano",
  ingenieria: "Ingeniería",
  compras: "Compras",
  construccion: "Construcción",
  comisionamiento: "Comisionamiento / Pruebas",
};

export const PHASE_TO_GROUP: Record<PhaseKey, PhaseGroup> = {
  campana_viento: "temprano",
  desarrollo: "temprano",
  conceptual: "temprano",
  basica: "ingenieria",
  detalle: "ingenieria",
  factibilidad: "ingenieria",
  compras: "compras",
  construccion: "construccion",
  comisionamiento: "comisionamiento",
  pruebas: "comisionamiento",
};

// Fase más próxima al COD -> más certeza; fase más lejana -> más incertidumbre.
// Heurística declarada, no un cálculo estadístico — no hay datos históricos
// propios todavía para calibrar la confianza real por etapa.
const PHASE_CONFIDENCE: Record<PhaseKey, ConfidenceLevel> = {
  campana_viento: "baja",
  desarrollo: "baja",
  conceptual: "baja",
  basica: "media",
  detalle: "media",
  factibilidad: "media",
  compras: "media",
  construccion: "alta",
  comisionamiento: "alta",
  pruebas: "alta",
};

export function getPhaseConfidence(phase: PhaseKey): ConfidenceLevel {
  return PHASE_CONFIDENCE[phase];
}

// Un color distinto por etapa — compartido entre la línea de tiempo de un
// proyecto (PhaseTimeline) y el Gantt agregado del pipeline (PipelineGanttChart),
// para que la misma etapa se lea igual en ambas vistas.
//
// Las 10 etapas son *ordinales* (un ciclo de vida con orden fijo, no identidades
// intercambiables — ver GROUP_PHASE_ORDER más abajo), así que en vez de 10 colores
// categóricos (imposible de mantener CVD-seguro más allá de ~8, y semánticamente
// incorrecto para algo ordenado) usan una sola rampa turquesa de luminosidad
// monótona (PHASE_ORDINAL_RAMP en lib/shared/chartColors.ts, validada con
// --ordinal). El color se vuelve más oscuro (claro en modo oscuro) a medida que
// el proyecto avanza — la misma historia que ya cuenta PHASE_CONFIDENCE
// (baja→media→alta). Etapas alternativas de un mismo punto del ciclo (ej.
// "compras" en proyectos no-PMGD vs "factibilidad" en PMGD; "comisionamiento" vs
// "pruebas") comparten paso de rampa a propósito: nunca aparecen juntas en el
// mismo proyecto.
import { lightDark, PHASE_ORDINAL_RAMP } from "./chartColors";

export const PHASE_COLORS: Record<PhaseKey, string> = {
  campana_viento: lightDark(PHASE_ORDINAL_RAMP[0]),
  desarrollo: lightDark(PHASE_ORDINAL_RAMP[0]),
  conceptual: lightDark(PHASE_ORDINAL_RAMP[1]),
  basica: lightDark(PHASE_ORDINAL_RAMP[2]),
  detalle: lightDark(PHASE_ORDINAL_RAMP[3]),
  factibilidad: lightDark(PHASE_ORDINAL_RAMP[4]),
  compras: lightDark(PHASE_ORDINAL_RAMP[4]),
  construccion: lightDark(PHASE_ORDINAL_RAMP[5]),
  comisionamiento: lightDark(PHASE_ORDINAL_RAMP[6]),
  pruebas: lightDark(PHASE_ORDINAL_RAMP[6]),
};

// Proporción min/max derivada del único ejemplo con rango explícito dado por
// el usuario (Construcción Solar: min 10, probable 14, max 18 meses).
const DEFAULT_MIN_RATIO = 10 / 14;
const DEFAULT_MAX_RATIO = 18 / 14;

function range(likely: number, min?: number, max?: number): DurationRange {
  return {
    min: min ?? Math.round(likely * DEFAULT_MIN_RATIO * 10) / 10,
    likely,
    max: max ?? Math.round(likely * DEFAULT_MAX_RATIO * 10) / 10,
  };
}

export type ProjectScheduleGroup =
  | "SOLAR_UTILITY"
  | "EOLICO"
  | "BESS_STANDALONE"
  | "SOLAR_BESS"
  | "EOLICO_BESS"
  | "HIBRIDO_GENERICO"
  | "PMGD";

export const GROUP_LABELS: Record<ProjectScheduleGroup, string> = {
  SOLAR_UTILITY: "Solar Utility Scale",
  EOLICO: "Parque Eólico",
  BESS_STANDALONE: "BESS Stand Alone",
  SOLAR_BESS: "Solar + BESS",
  EOLICO_BESS: "Eólico + BESS",
  HIBRIDO_GENERICO: "Híbrido (combinación no desglosada por la fuente)",
  PMGD: "PMGD",
};

export const GROUP_PHASE_ORDER: Record<ProjectScheduleGroup, PhaseKey[]> = {
  SOLAR_UTILITY: ["desarrollo", "conceptual", "basica", "detalle", "compras", "construccion", "comisionamiento"],
  EOLICO: ["campana_viento", "desarrollo", "conceptual", "basica", "detalle", "compras", "construccion", "comisionamiento"],
  BESS_STANDALONE: ["desarrollo", "conceptual", "basica", "detalle", "compras", "construccion", "comisionamiento"],
  SOLAR_BESS: ["desarrollo", "conceptual", "basica", "detalle", "compras", "construccion", "comisionamiento"],
  EOLICO_BESS: ["campana_viento", "desarrollo", "conceptual", "basica", "detalle", "compras", "construccion", "comisionamiento"],
  HIBRIDO_GENERICO: ["desarrollo", "conceptual", "basica", "detalle", "compras", "construccion", "comisionamiento"],
  PMGD: ["desarrollo", "conceptual", "basica", "detalle", "factibilidad", "construccion", "pruebas"],
};

/** Duración (min/probable/max) de cada etapa, en meses — no fecha de inicio. */
export const GROUP_DURATIONS: Record<ProjectScheduleGroup, Partial<Record<PhaseKey, DurationRange>>> = {
  SOLAR_UTILITY: {
    desarrollo: range(4),
    conceptual: range(3),
    basica: range(5),
    detalle: range(7),
    compras: range(9),
    construccion: range(14, 10, 18), // único rango explícito dado por el usuario
    comisionamiento: range(2),
  },
  EOLICO: {
    campana_viento: range(24),
    desarrollo: range(8),
    conceptual: range(4),
    basica: range(7),
    detalle: range(9),
    compras: range(12),
    construccion: range(24),
    comisionamiento: range(3),
  },
  BESS_STANDALONE: {
    desarrollo: range(4),
    conceptual: range(2),
    basica: range(4),
    detalle: range(5),
    compras: range(10),
    construccion: range(10),
    comisionamiento: range(2),
  },
  SOLAR_BESS: {
    desarrollo: range(5),
    conceptual: range(3),
    basica: range(6),
    detalle: range(8),
    compras: range(11),
    construccion: range(16),
    comisionamiento: range(2),
  },
  EOLICO_BESS: {
    campana_viento: range(24),
    desarrollo: range(9),
    conceptual: range(4),
    basica: range(8),
    detalle: range(10),
    compras: range(12),
    construccion: range(26),
    comisionamiento: range(3),
  },
  // Sin tabla propia del usuario (aplica a "Solar + Eólico" y combinaciones
  // sin desglose claro) — promedio de Solar+BESS y Eólico+BESS como estimación
  // intermedia razonable, declarada como interpolación, no dato dado.
  HIBRIDO_GENERICO: {
    desarrollo: range(7),
    conceptual: range(3.5),
    basica: range(7),
    detalle: range(9),
    compras: range(11.5),
    construccion: range(21),
    comisionamiento: range(2.5),
  },
  PMGD: {
    desarrollo: range(3),
    conceptual: range(2),
    basica: range(3),
    detalle: range(4),
    factibilidad: range(4.5, 3, 6), // rango explícito dado por el usuario
    construccion: range(10, 8, 12), // rango explícito dado por el usuario
    pruebas: range(1),
  },
};

/** Umbral regulatorio chileno: generación ≤9 MW conectada a distribución = PMGD (Reglamento MGPE). */
export const PMGD_CAPACITY_THRESHOLD_MW = 9;

export function getScheduleGroup(
  technologyCode: string | null,
  includesStorage: boolean,
  capacityMw: number | null,
): ProjectScheduleGroup | null {
  if (capacityMw !== null && capacityMw <= PMGD_CAPACITY_THRESHOLD_MW) return "PMGD";
  if (technologyCode === "bess") return "BESS_STANDALONE";
  if (technologyCode === "solar_pv") return includesStorage ? "SOLAR_BESS" : "SOLAR_UTILITY";
  if (technologyCode === "wind") return includesStorage ? "EOLICO_BESS" : "EOLICO";
  if (technologyCode === "hybrid") return "HIBRIDO_GENERICO";
  return null;
}

/**
 * Ventana esperada de tramitación SEIA por tecnología (ingreso a RCA), dada
 * por el usuario — se usa cuando el proyecto todavía no tiene un expediente
 * SEIA asociado, para mostrar una expectativa en vez de un vacío.
 */
export function getSeiaDurationRangeMonths(group: ProjectScheduleGroup): DurationRange | null {
  switch (group) {
    case "SOLAR_UTILITY":
    case "SOLAR_BESS":
      return { min: 12, likely: 15, max: 18 };
    case "EOLICO":
    case "EOLICO_BESS":
      return { min: 18, likely: 21, max: 24 };
    case "BESS_STANDALONE":
      return { min: 8, likely: 11.5, max: 15 };
    case "PMGD":
      return { min: 8, likely: 11, max: 14 };
    default:
      return null;
  }
}
