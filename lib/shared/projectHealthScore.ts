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
  environmentalTreatment: "seia" | "pertinencia" | "bess_no_automatico" | "sin_antecedente";
  environmentalNote: string;
}

export interface HealthScoreContext {
  projectKind?: string | null;
  includesStorage?: boolean;
  seiaSubmissionType?: string | null;
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

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function pertinenceScore(status: string | null): number | null {
  const normalized = normalize(status);
  if (!normalized) return 30;
  if (/no\s+(requiere|debe)\s+(ingresar|ingreso)|no\s+ingreso|no\s+corresponde\s+ingreso/.test(normalized)) return 100;
  if (/requiere\s+(ingresar|ingreso)|debe\s+ingresar|corresponde\s+ingreso/.test(normalized)) return 15;
  if (/resuelta|resuelto|respondida|respondido|finalizada|finalizado/.test(normalized)) return 80;
  if (/en\s+tramite|ingresada|ingresado|presentada|presentado/.test(normalized)) return 30;
  return null;
}

export function computeHealthScore(
  status: string | null,
  seiaStatus: string | null,
  estimatedConnectionDate: string | null,
  today: Date = new Date(),
  context: HealthScoreContext = {},
): HealthScoreResult {
  if (isRejectedStatus(status)) {
    return {
      score: null,
      band: "no_aplica",
      statusScore: null,
      seiaScore: null,
      overdue: false,
      environmentalTreatment: "sin_antecedente",
      environmentalNote: "Proyecto rechazado o desistido.",
    };
  }

  const statusMaturity = getStatusMaturity(status);
  const statusScore = statusMaturity?.order ?? null;

  // Un componente BESS no determina por sí solo el tratamiento ambiental.
  // La excepción conservadora aplica sólo al almacenamiento stand-alone; un
  // híbrido solar/eólico+BESS sigue la tipología de su proyecto y sus obras.
  const isStandaloneBess = context.projectKind === "storage";
  const isPertinence = normalize(context.seiaSubmissionType).includes("pertinen");
  const seiaMaturity = !isPertinence && seiaStatus && !isSeiaNegativeTerminal(seiaStatus) ? getSeiaMaturity(seiaStatus) : null;
  const seiaScore = isPertinence ? pertinenceScore(seiaStatus) : (seiaMaturity?.order ?? null);
  const environmentalTreatment = isPertinence
    ? "pertinencia"
    : context.seiaSubmissionType
      ? "seia"
      : isStandaloneBess
        ? "bess_no_automatico"
        : "sin_antecedente";
  const environmentalNote =
    environmentalTreatment === "pertinencia"
      ? "Se considera la consulta de pertinencia como antecedente ambiental del BESS."
      : environmentalTreatment === "bess_no_automatico"
        ? "La falta de DIA/EIA no penaliza: un BESS no tiene ingreso automático al SEIA; deben revisarse sus obras asociadas."
        : environmentalTreatment === "seia"
          ? "Se considera el avance del expediente DIA/EIA asociado."
          : "No se encontró un antecedente ambiental asociado.";

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
    environmentalTreatment,
    environmentalNote,
  };
}

export const HEALTH_BAND_COLOR: Record<Exclude<HealthBand, "no_aplica">, string> = {
  alto: "light-dark(#38d7c5, #38d7c5)",
  medio: "light-dark(#c2822a, #eab308)",
  bajo: "light-dark(#c23a2a, #ef4444)",
};
