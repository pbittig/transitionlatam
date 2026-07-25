// Paleta de gráficos — fuente única de verdad, derivada de:
//  - Manual de Marca Web §5 (paleta) y §10 "Estilo de Gráficos" (public/Manual de Marca.md):
//    Turquesa=Información principal, Gris=Histórico, Azul=Transmisión, Amarillo=Solar,
//    Verde=Eólica, Morado=BESS, Naranjo=Hidrógeno, Rojo=Alertas.
//  - La skill de dataviz del proyecto: cada hex viene de la paleta categórica de referencia
//    ya validada (references/palette.md — orden fijo blue/orange/aqua/yellow/magenta/green/
//    violet/red, que pasa los 6 chequeos de scripts/validate_palette.js en ambos modos), solo
//    renombrada por su significado de marca en vez de dejarla como "slot genérico N".
// No reordenar los valores: el orden es el mecanismo de seguridad CVD (ver color-formula.md
// de la skill), no un detalle cosmético.
export interface ChartColor {
  light: string;
  dark: string;
}

/** Turquesa de marca — único color "destacado"/serie única (KPIs, gráficos de una sola serie). */
export const PRINCIPAL_COLOR: ChartColor = { light: "#38d7c5", dark: "#38d7c5" };

/** Gris de marca — series históricas/de referencia, y categoría "Otros" cuando una tecnología no tiene color propio. */
export const HISTORICO_COLOR: ChartColor = { light: "#6b7280", dark: "#9ca3af" };
export const OTHER_COLOR = HISTORICO_COLOR;

/**
 * Colores por tecnología, con las mismas keys que MARKET_TECH_CATEGORIES
 * (lib/shared/marketTechCategories.ts) — la taxonomía canónica que ya normaliza
 * las 3 fuentes (power_plant.plant_type, construction_project.tipo_tecnologia_final,
 * project.technology.code). Normalizar con esas funciones antes de llamar a techColor()
 * para que un mismo concepto (ej. "Solares" en SIPUB, "solar_pv" en el pipeline) siempre
 * caiga en el mismo color, sin duplicar el mapeo acá.
 * "Geotérmica", "Híbrido" y "Data Center" no tienen color propio en el manual de marca —
 * caen a "Otros" (gris), como corresponde a una categoría fuera de las validadas (ver
 * dataviz skill: una 9ª serie nunca es un color generado, se pliega en "Otros").
 */
export const TECH_COLORS: Record<string, ChartColor> = {
  Transmisión: { light: "#2a78d6", dark: "#3987e5" }, // Azul
  Hidrógeno: { light: "#eb6834", dark: "#d95926" }, // Naranjo (sin categoría propia todavía, reservado)
  Hidro: { light: "#1baf7a", dark: "#199e70" }, // Aqua — sin nombre en el manual, asignado por afinidad (agua)
  Solar: { light: "#eda100", dark: "#c98500" }, // Amarillo
  Térmica: { light: "#e87ba4", dark: "#d55181" }, // Magenta — sin nombre en el manual, 5º slot validado restante
  Eólico: { light: "#008300", dark: "#008300" }, // Verde
  BESS: { light: "#4a3aa7", dark: "#9085e9" }, // Morado
  Alertas: { light: "#e34948", dark: "#e66767" }, // Rojo
};

export function techColor(category: string | null): ChartColor {
  return (category && TECH_COLORS[category]) || OTHER_COLOR;
}

/**
 * Mismos 8 hex de TECH_COLORS (+ Hidro/Térmica en su orden validado original), para series
 * *nominales* sin significado de marca (propietarios, estados de una central, regiones) —
 * identidad por posición, no por nombre. Orden fijo, nunca cíclico más allá de 8 (ver
 * dataviz skill): una 9ª categoría se pliega en "Otros" en el call site.
 */
export const GENERIC_CATEGORICAL: ChartColor[] = [
  TECH_COLORS.Transmisión, // blue
  TECH_COLORS.Hidrógeno, // orange
  TECH_COLORS.Hidro, // aqua
  TECH_COLORS.Solar, // yellow
  TECH_COLORS.Térmica, // magenta
  TECH_COLORS.Eólico, // green
  TECH_COLORS.BESS, // violet
  TECH_COLORS.Alertas, // red
];

/**
 * Estado (bueno/medio/crítico) — reservados, nunca reutilizados como "serie N" (ver dataviz
 * skill). "Alta" reusa la turquesa de marca (indicador positivo, ver manual §5); "baja"
 * reusa el rojo de alertas de TECH_COLORS.Alertas por consistencia con el resto del sitio.
 */
export const STATUS_COLORS = {
  alta: PRINCIPAL_COLOR,
  media: { light: "#c2822a", dark: "#eab308" } as ChartColor,
  baja: TECH_COLORS.Alertas,
};

/**
 * Rampa ordinal (una sola familia turquesa, luminosidad monótona) para el ciclo de vida de un
 * proyecto — no es una paleta categórica: son 10 etapas *ordenadas* (ver PhaseKey en
 * projectPhaseDurations.ts), así que el color debe leerse como progreso, no como identidad
 * (ver "Categorical or ordinal?" en color-formula.md de la skill de dataviz). Ambos modos
 * validados con --ordinal contra la superficie real del sitio (#FFFFFF / #0a0a0a).
 */
export const PHASE_ORDINAL_RAMP: ChartColor[] = [
  { light: "#26c9b4", dark: "#1f514b" },
  { light: "#1fa593", dark: "#2a6f66" },
  { light: "#198576", dark: "#379084" },
  { light: "#14695e", dark: "#45b5a6" },
  { light: "#105149", dark: "#6bc7bb" },
  { light: "#0b3c36", dark: "#9bd9d1" },
  { light: "#072420", dark: "#d6f0ec" },
];

export function lightDark(c: ChartColor): string {
  return `light-dark(${c.light}, ${c.dark})`;
}
