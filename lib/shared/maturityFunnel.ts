/**
 * Embudo de madurez — a diferencia del Embudo del pipeline (estado
 * administrativo del SAC: ingresada/con SEIA/con RCA/etapa avanzada), este
 * agrupa cada solicitud vigente por su macro-etapa REAL inferida del modelo
 * probabilístico de cronograma (Desarrollo/Ingeniería/Compras/Construcción/
 * Comisionamiento) — la misma clasificación que ya usa "Estado del Proyecto"
 * en la ficha individual, aplicada a todo el pipeline vigente. Corre en Node
 * sobre los insumos ya traídos por getUpcomingScheduleInputs, igual que el
 * calendario de hitos y la demanda de equipos.
 */

import { computeEstimatedPhase } from "./computeEstimatedPhase";
import { computeProjectSynthesis, MACRO_STAGE_LABEL, type MacroStage } from "./projectIntelligence";
import type { ScheduleForecastInput } from "@/lib/data-access/pipeline";

const FUNNEL_ORDER: MacroStage[] = ["desarrollo", "ingenieria", "compras", "construccion", "comisionamiento"];

// Orden de avance real — "operativo" (debería estar operativo, ya pasó el
// COD) cuenta como al menos tan avanzado como Comisionamiento para efectos
// del embudo; "no_iniciado" queda antes de Desarrollo.
const STAGE_RANK: Record<MacroStage, number> = {
  no_iniciado: 0,
  desarrollo: 1,
  ingenieria: 2,
  compras: 3,
  construccion: 4,
  comisionamiento: 5,
  operativo: 6,
};

export interface MaturityFunnelStage {
  stage: MacroStage;
  label: string;
  count: number;
}

export interface MaturityFunnel {
  total: number; // proyectos con cronograma estimable (excluye los sin tecnología clasificada)
  stages: MaturityFunnelStage[];
  skipped: number;
}

export function computeMaturityFunnel(inputs: ScheduleForecastInput[], today: Date = new Date()): MaturityFunnel {
  let skipped = 0;
  const ranks: number[] = [];

  for (const input of inputs) {
    const phase = computeEstimatedPhase(input.estimatedConnectionDate, input.technologyCode, input.includesStorage, input.capacityMw, today);
    const synthesis = computeProjectSynthesis(phase, input.estimatedConnectionDate, today);
    if (!synthesis) {
      skipped++;
      continue;
    }
    ranks.push(STAGE_RANK[synthesis.macroStage]);
  }

  const total = ranks.length;
  const stages: MaturityFunnelStage[] = FUNNEL_ORDER.map((stage) => ({
    stage,
    label: MACRO_STAGE_LABEL[stage],
    count: ranks.filter((r) => r >= STAGE_RANK[stage]).length,
  }));

  return { total, stages, skipped };
}
