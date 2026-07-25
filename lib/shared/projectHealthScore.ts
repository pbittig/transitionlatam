/**
 * Health Score de ejecución (0-100) — nuestra propia lectura combinada del
 * avance de un proyecto, no un dato oficial de ninguna fuente. Se construye
 * únicamente a partir de dos escalas de madurez que ya existen y ya se
 * muestran por separado en la ficha (projectStatusMaturity, seiaStatusMaturity),
 * más un chequeo de atraso que reutiliza el mismo criterio "overdue" que ya usa
 * el filtro de listProjects — no se inventa ninguna comparación nueva entre
 * modelos que no sea trazable a algo que el usuario ya puede ver en la ficha.
 */

import { getStatusMaturity, isRejectedStatus, type StatusBand } from "./projectStatusMaturity";
import { getSeiaMaturity, isSeiaNegativeTerminal } from "./seiaStatusMaturity";

export type HealthBand = "alto" | "medio" | "bajo" | "no_aplica";

export interface HealthScoreResult {
  score: number | null; // 0-100, null si no aplica (rechazado/desistido)
  band: HealthBand;
  statusScore: number | null;
  seiaScore: number | null;
  overdue: boolean;
}

export const HEALTH_BAND_LABEL: Record<HealthBand, string> = {
  alto: "Avance saludable",
  medio: "Avance moderado",
  bajo: "Avance bajo / en riesgo",
  no_aplica: "No aplica",
};

const STATUS_WEIGHT_WITH_SEIA = 0.6;
const SEIA_WEIGHT = 0.4;
const OVERDUE_PENALTY = 20;

function bandFromScore(score: number): HealthBand {
  if (score >= 70) return "alto";
  if (score >= 40) return "medio";
  return "bajo";
}

export function computeHealthScore(
  status: string | null,
  seiaStatus: string | null,
  estimatedConnectionDate: string | null,
  today: Date = new Date(),
): HealthScoreResult {
  if (isRejectedStatus(status)) {
    return { score: null, band: "no_aplica", statusScore: null, seiaScore: null, overdue: false };
  }

  const statusMaturity = getStatusMaturity(status);
  const statusScore = statusMaturity?.order ?? null;

  const seiaMaturity = seiaStatus && !isSeiaNegativeTerminal(seiaStatus) ? getSeiaMaturity(seiaStatus) : null;
  const seiaScore = seiaMaturity?.order ?? null;

  let score: number;
  if (statusScore !== null && seiaScore !== null) {
    score = statusScore * STATUS_WEIGHT_WITH_SEIA + seiaScore * SEIA_WEIGHT;
  } else if (statusScore !== null) {
    score = statusScore;
  } else if (seiaScore !== null) {
    score = seiaScore;
  } else {
    score = 0;
  }

  const advancedBands: StatusBand[] = ["construccion", "finalizado"];
  const band = statusMaturity?.band ?? "inicial";
  const overdue = !!estimatedConnectionDate && new Date(estimatedConnectionDate) < today && !advancedBands.includes(band);

  const finalScore = Math.max(0, overdue ? score - OVERDUE_PENALTY : score);

  return {
    score: Math.round(finalScore),
    band: bandFromScore(finalScore),
    statusScore,
    seiaScore,
    overdue,
  };
}

export const HEALTH_BAND_COLOR: Record<Exclude<HealthBand, "no_aplica">, string> = {
  alto: "light-dark(#38d7c5, #38d7c5)",
  medio: "light-dark(#c2822a, #eab308)",
  bajo: "light-dark(#c23a2a, #ef4444)",
};
