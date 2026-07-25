/**
 * Capa de "inteligencia derivada" sobre el pipeline — a diferencia del Health
 * Score (una sola lectura de avance combinado), estas funciones responden
 * preguntas de decisión puntuales (¿en qué etapa real está?, ¿cuál es el
 * próximo hito?, ¿hay ventana comercial abierta para EPC?, ¿qué tan probable
 * es que cumpla el COD?). Todo se deriva de datos que ya existen — el modelo
 * probabilístico de cronograma (computeEstimatedPhase) y las dos escalas de
 * madurez ya usadas por el Health Score — sin fuentes nuevas. Como el resto
 * del modelo probabilístico, son estimaciones propias, nunca un dato oficial.
 */

import type { EstimatedPhaseResult } from "./computeEstimatedPhase";
import type { ConfidenceLevel, PhaseKey } from "./projectPhaseDurations";
import { getStatusMaturity, isRejectedStatus, type StatusBand } from "./projectStatusMaturity";
import { getSeiaMaturity, isSeiaNegativeTerminal } from "./seiaStatusMaturity";

// ---------------------------------------------------------------------------
// 1. Estatus del Proyecto (síntesis) — reemplaza tener que leer SAC + SEIA +
// cronograma por separado para entender dónde está parado el proyecto.
// ---------------------------------------------------------------------------

export type MacroStage = "desarrollo" | "ingenieria" | "compras" | "construccion" | "comisionamiento" | "operativo" | "no_iniciado";

const PHASE_TO_MACRO_STAGE: Record<PhaseKey, MacroStage> = {
  campana_viento: "desarrollo",
  desarrollo: "desarrollo",
  factibilidad: "desarrollo",
  conceptual: "ingenieria",
  basica: "ingenieria",
  detalle: "ingenieria",
  compras: "compras",
  construccion: "construccion",
  comisionamiento: "comisionamiento",
  pruebas: "comisionamiento",
};

export const MACRO_STAGE_LABEL: Record<MacroStage, string> = {
  desarrollo: "En Desarrollo",
  ingenieria: "En Ingeniería",
  compras: "En Compras",
  construccion: "En Construcción",
  comisionamiento: "En Comisionamiento",
  operativo: "Debería estar Operativo",
  no_iniciado: "Aún no iniciado",
};

export interface ProjectSynthesis {
  macroStage: MacroStage;
  macroStageLabel: string;
  currentPhaseLabel: string | null;
  confidence: ConfidenceLevel | null;
  progressPct: number; // 0-100 — posición de hoy entre el inicio estimado y el COD
  narrative: string;
}

export function computeProjectSynthesis(
  estimatedPhase: EstimatedPhaseResult | null,
  estimatedConnectionDate: string | null,
  today: Date = new Date(),
): ProjectSynthesis | null {
  if (!estimatedPhase || !estimatedConnectionDate) return null;

  const poc = new Date(estimatedConnectionDate).getTime();
  const firstMilestone = estimatedPhase.milestones[0];
  const start = firstMilestone ? new Date(firstMilestone.maxStartDate).getTime() : poc;
  const span = poc - start || 1;
  const progressPct = Math.round(Math.min(Math.max(((today.getTime() - start) / span) * 100, 0), 100));

  let macroStage: MacroStage;
  let currentPhaseLabel: string | null = null;
  let confidence: ConfidenceLevel | null = null;

  if (estimatedPhase.pastConnectionDate) {
    macroStage = "operativo";
  } else if (!estimatedPhase.currentPhase) {
    macroStage = "no_iniciado";
  } else {
    macroStage = PHASE_TO_MACRO_STAGE[estimatedPhase.currentPhase];
    const milestone = estimatedPhase.milestones.find((m) => m.phase === estimatedPhase.currentPhase);
    currentPhaseLabel = milestone?.label ?? null;
    confidence = milestone?.confidence ?? null;
  }

  const narrative = estimatedPhase.pastConnectionDate
    ? "La fecha estimada de conexión ya pasó — el proyecto debería estar en operación."
    : currentPhaseLabel
      ? `Actualmente estimamos que el proyecto se encuentra en ${currentPhaseLabel}.`
      : "Aún no debería haber iniciado desarrollo según la fecha estimada de conexión.";

  return { macroStage, macroStageLabel: MACRO_STAGE_LABEL[macroStage], currentPhaseLabel, confidence, progressPct, narrative };
}

// ---------------------------------------------------------------------------
// 2. Próximo hito esperado — el siguiente hito del cronograma que aún no se
// ha alcanzado (o la fecha de conexión, si ya se cumplieron todas las etapas).
// ---------------------------------------------------------------------------

export interface NextMilestone {
  label: string;
  expectedDate: string; // ISO
  confidence: ConfidenceLevel;
}

export function computeNextMilestone(estimatedPhase: EstimatedPhaseResult | null): NextMilestone | null {
  if (!estimatedPhase || estimatedPhase.pastConnectionDate) return null;
  const next = estimatedPhase.milestones.find((m) => !m.reached);
  if (!next) return null;
  return { label: next.label, expectedDate: next.estimatedStartDate, confidence: next.confidence };
}

// ---------------------------------------------------------------------------
// 3. Ventana comercial — el tramo entre "Compras" y "Construcción" donde el
// proyecto probablemente todavía no adjudica EPC/equipos. Se deriva del mismo
// cronograma, sin inventar una fecha de adjudicación real.
// ---------------------------------------------------------------------------

export interface CommercialWindow {
  status: "abierta" | "cerrada" | "aun_no_abre";
  opensAt: string;
  closesAt: string;
}

export function computeCommercialWindow(estimatedPhase: EstimatedPhaseResult | null): CommercialWindow | null {
  if (!estimatedPhase) return null;
  const compras = estimatedPhase.milestones.find((m) => m.phase === "compras");
  const construccion = estimatedPhase.milestones.find((m) => m.phase === "construccion");
  if (!compras || !construccion) return null;

  const status: CommercialWindow["status"] = construccion.reached ? "cerrada" : compras.reached ? "abierta" : "aun_no_abre";
  return { status, opensAt: compras.estimatedStartDate, closesAt: construccion.estimatedStartDate };
}

// ---------------------------------------------------------------------------
// 4. Probabilidad de cumplir el COD — heurística propia (no una probabilidad
// estadística calibrada) que combina las mismas señales del Health Score,
// pero expuesta como una lectura de riesgo con razones explícitas en vez de
// un solo número — la parte "explicable" es el punto.
// ---------------------------------------------------------------------------

export interface CodOutlookStep {
  label: string;
  delta: number; // positivo o negativo — 0 para el paso "Base"
}

export interface CodOutlook {
  score: number | null; // 0-100, null si no aplica (rechazado/desistido)
  band: "alta" | "media" | "baja" | "no_aplica";
  breakdown: CodOutlookStep[]; // primer paso siempre es "Base"; el resto suma/resta hasta llegar a `score`
}

const COD_OUTLOOK_BASE = 40;

export function computeCodOutlook(
  status: string | null,
  seiaStatus: string | null,
  estimatedConnectionDate: string | null,
  today: Date = new Date(),
): CodOutlook {
  if (isRejectedStatus(status)) return { score: null, band: "no_aplica", breakdown: [] };

  const statusMaturity = getStatusMaturity(status);
  const seiaMaturity = seiaStatus && !isSeiaNegativeTerminal(seiaStatus) ? getSeiaMaturity(seiaStatus) : null;
  const band: StatusBand = statusMaturity?.band ?? "inicial";

  const breakdown: CodOutlookStep[] = [{ label: "Base", delta: COD_OUTLOOK_BASE }];
  let score = COD_OUTLOOK_BASE;

  if (seiaMaturity?.band === "aprobado") {
    breakdown.push({ label: "RCA aprobada", delta: 25 });
    score += 25;
  } else if (seiaMaturity) {
    breakdown.push({ label: "SEIA en trámite", delta: 5 });
    score += 5;
  } else {
    breakdown.push({ label: "Sin expediente SEIA asociado", delta: 0 });
  }

  if (band === "construccion" || band === "finalizado") {
    const delta = 25;
    breakdown.push({ label: band === "finalizado" ? "Proyecto finalizado" : "Declarado en construcción", delta });
    score += delta;
  } else if (band === "avanzado") {
    breakdown.push({ label: "Trámite de conexión en etapa avanzada", delta: 15 });
    score += 15;
  } else if (band === "inicial") {
    breakdown.push({ label: "Trámite de conexión todavía en etapa inicial", delta: 0 });
  }

  const isAdvanced = band === "construccion" || band === "finalizado";
  const overdue = !!estimatedConnectionDate && new Date(estimatedConnectionDate).getTime() < today.getTime() && !isAdvanced;
  if (overdue) {
    breakdown.push({ label: "Fecha estimada de conexión ya pasó sin llegar a construcción", delta: -30 });
    score -= 30;
  } else if (estimatedConnectionDate && !isAdvanced) {
    const monthsLeft = (new Date(estimatedConnectionDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    if (monthsLeft < 6) {
      breakdown.push({ label: `Solo quedan ~${Math.max(Math.round(monthsLeft), 0)} meses para el COD`, delta: -15 });
      score -= 15;
    }
  }

  score = Math.max(0, Math.min(100, score));
  const outlookBand: CodOutlook["band"] = score >= 70 ? "alta" : score >= 40 ? "media" : "baja";
  return { score, band: outlookBand, breakdown };
}
