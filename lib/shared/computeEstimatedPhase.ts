import {
  GROUP_DURATIONS,
  GROUP_LABELS,
  GROUP_PHASE_ORDER,
  PHASE_LABELS,
  getPhaseConfidence,
  getScheduleGroup,
  type ConfidenceLevel,
  type PhaseKey,
  type ProjectScheduleGroup,
} from "./projectPhaseDurations";

export interface PhaseMilestone {
  phase: PhaseKey;
  label: string;
  estimatedStartDate: string; // ISO date — escenario "más probable"
  minStartDate: string; // ISO date — escenario más rápido (holgura mínima)
  maxStartDate: string; // ISO date — escenario más lento (holgura máxima)
  confidence: ConfidenceLevel;
  reached: boolean;
}

export interface EstimatedPhaseResult {
  group: ProjectScheduleGroup;
  groupLabel: string;
  milestones: PhaseMilestone[];
  currentPhase: PhaseKey | null; // null = aún no debería haber iniciado ni la primera etapa
  pastConnectionDate: boolean; // ya pasó el POC — debería estar en operación
  totalDurationMonths: number; // suma de duraciones "probable" — no necesariamente el tiempo real por superposición entre etapas
}

function subtractMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const wholeMonths = Math.trunc(months);
  const fractionDays = (months - wholeMonths) * 30.44;
  result.setUTCMonth(result.getUTCMonth() - wholeMonths);
  result.setUTCDate(result.getUTCDate() - Math.round(fractionDays));
  return result;
}

/**
 * Reconstruye probabilísticamente el cronograma completo del proyecto por
 * ingeniería reversa desde la fecha estimada de conexión (POC/COD), usando el
 * modelo de duraciones por etapa de projectPhaseDurations.ts. Para cada etapa
 * entrega fecha mínima, más probable y máxima — nunca una fecha única. Es una
 * estimación de mercado, no un dato confirmado del proyecto (ver
 * docs/04-modelo-datos.md §4.3).
 */
export function computeEstimatedPhase(
  estimatedConnectionDate: string | null,
  technologyCode: string | null,
  includesStorage: boolean,
  capacityMw: number | null,
  today: Date = new Date(),
): EstimatedPhaseResult | null {
  if (!estimatedConnectionDate) return null;
  const group = getScheduleGroup(technologyCode, includesStorage, capacityMw);
  if (!group) return null;

  const poc = new Date(estimatedConnectionDate);
  const phaseOrder = GROUP_PHASE_ORDER[group];
  const durations = GROUP_DURATIONS[group];

  // Se acumula desde la última etapa (COD) hacia la primera: el offset de
  // cada etapa es la suma de su propia duración más la de todas las etapas
  // posteriores — así el orden queda siempre no decreciente por construcción
  // (a diferencia del modelo anterior, no hace falta forzarlo al dibujar).
  let likelyAcc = 0;
  let minAcc = 0;
  let maxAcc = 0;
  let totalDurationMonths = 0;
  const offsets = new Map<PhaseKey, { likely: number; min: number; max: number }>();

  for (let i = phaseOrder.length - 1; i >= 0; i--) {
    const phase = phaseOrder[i];
    const d = durations[phase];
    if (!d) continue;
    likelyAcc += d.likely;
    minAcc += d.min;
    maxAcc += d.max;
    totalDurationMonths += d.likely;
    // offset mínimo (escenario rápido) usa duraciones mínimas -> fecha más
    // cercana al POC; offset máximo (escenario lento) usa duraciones máximas
    // -> fecha más lejana al POC.
    offsets.set(phase, { likely: likelyAcc, min: minAcc, max: maxAcc });
  }

  const milestones: PhaseMilestone[] = phaseOrder
    .filter((phase) => offsets.has(phase))
    .map((phase) => {
      const o = offsets.get(phase)!;
      const likelyDate = subtractMonths(poc, o.likely);
      return {
        phase,
        label: PHASE_LABELS[phase],
        estimatedStartDate: likelyDate.toISOString().slice(0, 10),
        minStartDate: subtractMonths(poc, o.min).toISOString().slice(0, 10),
        maxStartDate: subtractMonths(poc, o.max).toISOString().slice(0, 10),
        confidence: getPhaseConfidence(phase),
        reached: today >= likelyDate,
      };
    });

  const reachedMilestones = milestones.filter((m) => m.reached);
  const currentPhase = reachedMilestones.length > 0 ? reachedMilestones[reachedMilestones.length - 1].phase : null;

  return {
    group,
    groupLabel: GROUP_LABELS[group],
    milestones,
    currentPhase,
    pastConnectionDate: today >= poc,
    totalDurationMonths,
  };
}
