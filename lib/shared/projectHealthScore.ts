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
import { parseVoltageKv, requiresEnvironmentalReview } from "./environmentalReviewRules";

export type HealthBand = "alto" | "medio" | "bajo" | "no_aplica";

export interface HealthScoreResult {
  score: number | null; // 0-100, null si no aplica (rechazado/desistido)
  band: HealthBand;
  statusScore: number | null;
  seiaScore: number | null;
  overdue: boolean;
  environmentalTreatment: "seia" | "pertinencia" | "bess_no_automatico" | "requerido_pendiente" | "concluido_por_construccion" | "sin_antecedente";
  environmentalNote: string;
}

export interface HealthScoreContext {
  projectKind?: string | null;
  includesStorage?: boolean;
  seiaSubmissionType?: string | null;
  /** Capacidad de generación en MW — para el umbral de ingreso SEIA obligatorio (ver environmentalReviewRules.ts). */
  generationCapacityMw?: number | null;
  /** Voltaje de conexión (ej. "23", "220 kV") — para el umbral de BESS standalone. */
  voltageLevel?: string | null;
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
  const advancedBands: StatusBand[] = ["construccion", "finalizado"];
  const alreadyInConstruction = !!statusMaturity && advancedBands.includes(statusMaturity.band);

  // Un componente BESS no determina por sí solo el tratamiento ambiental.
  // La excepción conservadora aplica sólo al almacenamiento stand-alone; un
  // híbrido solar/eólico+BESS sigue la tipología de su proyecto y sus obras.
  const isStandaloneBess = context.projectKind === "storage";
  const isPertinence = normalize(context.seiaSubmissionType).includes("pertinen");
  const seiaMaturity = !isPertinence && seiaStatus && !isSeiaNegativeTerminal(seiaStatus) ? getSeiaMaturity(seiaStatus) : null;
  const hasEnvironmentalRecord = isPertinence || !!context.seiaSubmissionType;
  // Sin antecedente todavía, pero según tamaño/voltaje la ley debería exigirlo
  // (ver environmentalReviewRules.ts) — a diferencia de "sin_antecedente", esto
  // sí penaliza: no es que no aplique, es que falta un paso obligatorio. Salvo
  // que el proyecto ya esté declarado en construcción: no se puede llegar ahí
  // legalmente sin haber resuelto el trámite ambiental, así que la falta del
  // antecedente en nuestros datos se lee como un vacío de matching nuestro, no
  // como un paso pendiente del proyecto — no corresponde penalizar.
  const environmentallyRequired =
    !hasEnvironmentalRecord &&
    !alreadyInConstruction &&
    requiresEnvironmentalReview({
      isStandaloneBess,
      generationCapacityMw: context.generationCapacityMw ?? null,
      voltageLevelKv: parseVoltageKv(context.voltageLevel),
    });
  const concludedByConstruction =
    !hasEnvironmentalRecord &&
    alreadyInConstruction &&
    requiresEnvironmentalReview({
      isStandaloneBess,
      generationCapacityMw: context.generationCapacityMw ?? null,
      voltageLevelKv: parseVoltageKv(context.voltageLevel),
    });
  const seiaScore = isPertinence
    ? pertinenceScore(seiaStatus)
    : seiaMaturity
      ? seiaMaturity.order
      : concludedByConstruction
        ? 100
        : environmentallyRequired
          ? 15 // mismo valor que "requiere ingreso" en pertinenceScore — misma situación: se sabe que corresponde y aún no hay antecedente.
          : null;
  const environmentalTreatment = isPertinence
    ? "pertinencia"
    : context.seiaSubmissionType
      ? "seia"
      : concludedByConstruction
        ? "concluido_por_construccion"
        : environmentallyRequired
          ? "requerido_pendiente"
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
          : environmentalTreatment === "concluido_por_construccion"
            ? "El proyecto ya fue declarado en construcción — el trámite ambiental se considera concluido aunque no tengamos el expediente vinculado."
            : environmentalTreatment === "requerido_pendiente"
              ? "El proyecto debería tener un antecedente ambiental (DIA/EIA) según su tamaño o voltaje de conexión, pero no se encontró ninguno."
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

  const band = statusMaturity?.band ?? "inicial";
  // Once a project reaches "construcción" or later, whether/when it's actually
  // built is a commercial decision for the developer, not a project-health
  // problem — so this band stays exempt from the overdue check regardless of
  // physical construction pace (PGP is shown elsewhere on the ficha, not
  // folded into this score).
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
