/**
 * Agregación en Node (no en SQL) del modelo probabilístico de cronograma
 * (computeEstimatedPhase) sobre todo el pipeline vigente — a diferencia de los
 * benchmarks de antigüedad (que sí necesitan SQL por el volumen histórico
 * total), este cálculo corre sobre ~750-1000 filas ya traídas en una sola
 * consulta (getUpcomingScheduleInputs), bajo el tope de PostgREST, así que
 * agregar en JS reutilizando la misma función que ya se usa en cada ficha es
 * más simple que portar el modelo de duraciones a SQL.
 */

import { computeEstimatedPhase } from "./computeEstimatedPhase";
import type { PhaseKey } from "./projectPhaseDurations";
import type { ScheduleForecastInput } from "@/lib/data-access/pipeline";

export interface MilestoneMonthEntry {
  yearMonth: string; // "YYYY-MM"
  capacityMw: number;
  count: number;
}

export interface MilestoneCalendar {
  phase: PhaseKey;
  entries: MilestoneMonthEntry[];
}

export interface EquipmentDemandEntry {
  year: number;
  technologyGroup: string;
  capacityMw: number;
  count: number;
}

export interface ScheduleForecastResult {
  milestoneCalendars: MilestoneCalendar[];
  equipmentDemand: EquipmentDemandEntry[];
  skipped: number;
}

const FORECAST_PHASES: PhaseKey[] = ["basica", "compras", "construccion"];
const FORECAST_PHASE_LABELS: Record<string, string> = {
  basica: "Inicio de Ingeniería Básica",
  compras: "Inicio de Compras",
  construccion: "Inicio de Construcción",
};

export { FORECAST_PHASE_LABELS };

/**
 * Ventana de meses hacia atrás/adelante desde hoy — hacia atrás para mostrar
 * hitos que probablemente ya están en curso (una Compras que empezó hace 3
 * meses para un proyecto que conecta en 2027 sigue siendo relevante hoy).
 */
export function computeScheduleForecast(
  inputs: ScheduleForecastInput[],
  monthsBack = 6,
  monthsAhead = 24,
  today: Date = new Date(),
): ScheduleForecastResult {
  const monthBuckets = new Map<PhaseKey, Map<string, MilestoneMonthEntry>>();
  for (const phase of FORECAST_PHASES) monthBuckets.set(phase, new Map());

  const yearBuckets = new Map<string, EquipmentDemandEntry>();

  const minYearMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - monthsBack, 1)).toISOString().slice(0, 7);
  const maxYearMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + monthsAhead, 1)).toISOString().slice(0, 7);

  let skipped = 0;

  for (const input of inputs) {
    const result = computeEstimatedPhase(input.estimatedConnectionDate, input.technologyCode, input.includesStorage, input.capacityMw, today);
    if (!result) {
      skipped++;
      continue;
    }

    for (const phaseKey of FORECAST_PHASES) {
      const milestone = result.milestones.find((m) => m.phase === phaseKey);
      if (!milestone) continue;
      const yearMonth = milestone.estimatedStartDate.slice(0, 7);
      if (yearMonth < minYearMonth || yearMonth > maxYearMonth) continue;
      const bucket = monthBuckets.get(phaseKey)!;
      const cur = bucket.get(yearMonth) ?? { yearMonth, capacityMw: 0, count: 0 };
      cur.capacityMw += input.capacityMw ?? 0;
      cur.count += 1;
      bucket.set(yearMonth, cur);
    }

    const compras = result.milestones.find((m) => m.phase === "compras");
    if (compras) {
      const year = Number(compras.estimatedStartDate.slice(0, 4));
      if (year < today.getUTCFullYear() || year > today.getUTCFullYear() + 4) continue;
      const key = `${result.groupLabel}|${year}`;
      const cur = yearBuckets.get(key) ?? { year, technologyGroup: result.groupLabel, capacityMw: 0, count: 0 };
      cur.capacityMw += input.capacityMw ?? 0;
      cur.count += 1;
      yearBuckets.set(key, cur);
    }
  }

  const milestoneCalendars: MilestoneCalendar[] = FORECAST_PHASES.map((phase) => ({
    phase,
    entries: [...monthBuckets.get(phase)!.values()].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth)),
  }));

  const equipmentDemand = [...yearBuckets.values()].sort((a, b) => a.year - b.year || a.technologyGroup.localeCompare(b.technologyGroup));

  return { milestoneCalendars, equipmentDemand, skipped };
}
