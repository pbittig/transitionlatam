import {
  GROUP_LABELS,
  GROUP_PHASE_ORDER,
  PHASE_LABELS,
  getPhaseConfidence,
  getScheduleGroup,
  type ConfidenceLevel,
  type PhaseKey,
  type ProjectScheduleGroup,
} from "./projectPhaseDurations";
import {
  estimateProjectTimeline,
  type PdteConnectionType,
  type PdteEnvironmental,
  type PdteTechnology,
} from "./projectTimelineEstimator";

export interface PhaseMilestone {
  phase: PhaseKey;
  label: string;
  estimatedStartDate: string;
  minStartDate: string;
  maxStartDate: string;
  confidence: ConfidenceLevel;
  reached: boolean;
}

export interface EstimatedPhaseResult {
  group: ProjectScheduleGroup;
  groupLabel: string;
  milestones: PhaseMilestone[];
  currentPhase: PhaseKey | null;
  pastConnectionDate: boolean;
  totalDurationMonths: number;
}

/** Optional facts are additive so existing callers remain source-compatible. */
export interface EstimatedPhaseOptions {
  storageMwh?: number | null;
  connectionType?: PdteConnectionType;
  voltageLevelKv?: number | null;
  environmental?: PdteEnvironmental;
  newSubstation?: boolean;
  newTransmissionLine?: boolean;
  lineLengthKm?: number | null;
  developer?: string | null;
  region?: string | null;
}

function subtractMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const whole = Math.trunc(months);
  result.setUTCMonth(result.getUTCMonth() - whole);
  result.setUTCDate(result.getUTCDate() - Math.round((months - whole) * 30.44));
  return result;
}

function technologyFor(group: ProjectScheduleGroup, includesStorage: boolean): PdteTechnology {
  if (group === "PMGD") return "PMGD";
  if (group === "SOLAR_UTILITY") return "Solar";
  if (group === "BESS_STANDALONE") return "BESS";
  if (group === "SOLAR_BESS") return "Solar+BESS";
  if (group === "EOLICO") return "Wind";
  if (group === "EOLICO_BESS") return "Wind+BESS";
  return includesStorage ? "Solar+BESS" : "Solar";
}

const STAGE_BY_PHASE: Partial<Record<PhaseKey, string[]>> = {
  campana_viento: ["campana_viento"],
  desarrollo: ["prospeccion"],
  conceptual: ["prefactibilidad", "conceptual"],
  basica: ["basica", "acceso_abierto"],
  detalle: ["detalle"],
  compras: ["compras"],
  construccion: ["construccion"],
  comisionamiento: ["comisionamiento"],
  factibilidad: ["factibilidad"],
  pruebas: ["pruebas"],
};

/**
 * Backwards-compatible projection of the detailed PDTE into the seven/eight
 * broad phases consumed by the current UI and aggregate forecast.
 */
export function computeEstimatedPhase(
  estimatedConnectionDate: string | null,
  technologyCode: string | null,
  includesStorage: boolean,
  capacityMw: number | null,
  today: Date = new Date(),
  options: EstimatedPhaseOptions = {},
): EstimatedPhaseResult | null {
  if (!estimatedConnectionDate) return null;
  const group = getScheduleGroup(technologyCode, includesStorage, capacityMw);
  if (!group) return null;
  const poc = new Date(estimatedConnectionDate);
  if (Number.isNaN(poc.getTime())) return null;

  const estimate = estimateProjectTimeline({
    technology: technologyFor(group, includesStorage),
    codDate: estimatedConnectionDate,
    installedPowerMw: capacityMw,
    storageMwh: options.storageMwh,
    connectionType: options.connectionType,
    voltageLevelKv: options.voltageLevelKv,
    environmental: options.environmental ?? "None",
    newSubstation: options.newSubstation,
    newTransmissionLine: options.newTransmissionLine,
    lineLengthKm: options.lineLengthKm,
    developer: options.developer,
    region: options.region,
  });
  if (!estimate) return null;

  const milestones: PhaseMilestone[] = GROUP_PHASE_ORDER[group].flatMap((phase) => {
    const keys = STAGE_BY_PHASE[phase] ?? [];
    const candidates = estimate.timeline.filter((stage) => keys.includes(stage.key));
    if (!candidates.length) return [];
    const likelyDate = new Date(candidates[0].estimatedStart);
    const monthsToCod = Math.max(0, (poc.getTime() - likelyDate.getTime()) / (30.44 * 86400000));
    const uncertainty = Math.max(1, monthsToCod * 0.14);
    return [{
      phase,
      label: PHASE_LABELS[phase],
      estimatedStartDate: likelyDate.toISOString().slice(0, 10),
      minStartDate: subtractMonths(likelyDate, -uncertainty).toISOString().slice(0, 10),
      maxStartDate: subtractMonths(likelyDate, uncertainty).toISOString().slice(0, 10),
      confidence: getPhaseConfidence(phase),
      reached: today >= likelyDate,
    }];
  });

  const reached = milestones.filter((milestone) => milestone.reached);
  return {
    group,
    groupLabel: GROUP_LABELS[group],
    milestones,
    currentPhase: reached.length ? reached[reached.length - 1].phase : null,
    pastConnectionDate: today >= poc,
    totalDurationMonths: estimate.totalDuration,
  };
}
