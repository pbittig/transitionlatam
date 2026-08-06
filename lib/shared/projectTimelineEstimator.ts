/**
 * PDTE: deterministic reverse schedule for Chilean power projects.
 *
 * Dates are anchored to COD and calculated backwards.  Values are market
 * assumptions, not regulatory deadlines.  The model intentionally uses
 * start offsets (rather than adding phase durations) because development,
 * permitting, engineering and procurement normally overlap.
 */

export type PdteTechnology = "Solar" | "BESS" | "Solar+BESS" | "Wind" | "Wind+BESS" | "PMGD";
export type PdteEnvironmental = "None" | "DIA" | "EIA";
export type PdteConnectionType = "SAC" | "SUCTD" | null;
export type PdteScale = "XS" | "S" | "M" | "L" | "XL";
export type PdteConfidence = "alta" | "media" | "baja";
export type PdteRisk = "bajo" | "medio" | "alto";

export interface PdteInput {
  technology: PdteTechnology;
  codDate: string;
  installedPowerMw: number | null;
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

export interface PdteStage {
  key: string;
  stage: string;
  estimatedStart: string;
  estimatedFinish: string;
  durationMonths: number;
  confidence: PdteConfidence;
}

export interface PdteResult {
  technology: PdteTechnology;
  scale: PdteScale;
  timeline: PdteStage[];
  criticalPath: string[];
  totalDuration: number;
  developmentStart: string;
  confidence: PdteConfidence;
  riskLevel: PdteRisk;
  appliedAdjustments: string[];
}

interface StageDefinition { key: string; label: string; offset: number }

const TEMPLATES: Record<PdteTechnology, StageDefinition[]> = {
  Solar: [
    { key: "prospeccion", label: "Prospección", offset: 36 },
    { key: "prefactibilidad", label: "Prefactibilidad", offset: 34 },
    { key: "conceptual", label: "Ingeniería Conceptual", offset: 32 },
    { key: "basica", label: "Ingeniería Básica", offset: 30 },
    { key: "acceso_abierto", label: "Acceso Abierto", offset: 27 },
    { key: "detalle", label: "Ingeniería de Detalle", offset: 20 },
    { key: "compras", label: "Procurement", offset: 15 },
    { key: "construccion", label: "Construcción", offset: 11 },
    { key: "comisionamiento", label: "Comisionamiento", offset: 1 },
  ],
  BESS: [
    { key: "prospeccion", label: "Prospección", offset: 30 },
    { key: "prefactibilidad", label: "Prefactibilidad", offset: 28 },
    { key: "conceptual", label: "Ingeniería Conceptual", offset: 26 },
    { key: "basica", label: "Ingeniería Básica", offset: 24 },
    { key: "acceso_abierto", label: "Acceso Abierto", offset: 21 },
    { key: "detalle", label: "Ingeniería de Detalle", offset: 15 },
    { key: "compras", label: "Procurement (baterías/PCS)", offset: 11 },
    { key: "construccion", label: "Construcción", offset: 8 },
    { key: "comisionamiento", label: "Comisionamiento", offset: 1 },
  ],
  "Solar+BESS": [],
  Wind: [
    { key: "prospeccion", label: "Prospección", offset: 48 },
    { key: "campana_viento", label: "Campaña de medición de viento", offset: 46 },
    { key: "prefactibilidad", label: "Prefactibilidad", offset: 38 },
    { key: "wind_assessment", label: "Validación del recurso eólico", offset: 34 },
    { key: "micrositing", label: "Micrositing", offset: 31 },
    { key: "conceptual", label: "Ingeniería Conceptual", offset: 30 },
    { key: "basica", label: "Ingeniería Básica", offset: 27 },
    { key: "acceso_abierto", label: "Acceso Abierto", offset: 25 },
    { key: "detalle", label: "Ingeniería de Detalle", offset: 20 },
    { key: "compras", label: "Procurement", offset: 16 },
    { key: "construccion", label: "Construcción", offset: 12 },
    { key: "comisionamiento", label: "Comisionamiento", offset: 2 },
  ],
  "Wind+BESS": [],
  PMGD: [
    { key: "prospeccion", label: "Prospección", offset: 24 },
    { key: "prefactibilidad", label: "Prefactibilidad", offset: 22 },
    { key: "conceptual", label: "Ingeniería Conceptual", offset: 20 },
    { key: "basica", label: "Ingeniería Básica", offset: 17 },
    { key: "factibilidad", label: "Factibilidad / conexión en distribución", offset: 14 },
    { key: "detalle", label: "Ingeniería de Detalle", offset: 10 },
    { key: "construccion", label: "Construcción", offset: 8 },
    { key: "pruebas", label: "Pruebas y puesta en servicio", offset: 1 },
  ],
};

function hybrid(base: PdteTechnology, total: number): StageDefinition[] {
  const stages = TEMPLATES[base].map((stage) => ({ ...stage, offset: stage.key === "prospeccion" ? total : stage.offset }));
  stages.push(
    { key: "integracion_ems", label: "Integración EMS/PPC", offset: 7 },
    { key: "integracion_scada", label: "Integración SCADA", offset: 5 },
    { key: "fat_sat_bess", label: "FAT/SAT BESS", offset: 2 },
  );
  return stages.sort((a, b) => b.offset - a.offset);
}
TEMPLATES["Solar+BESS"] = hybrid("Solar", 38);
TEMPLATES["Wind+BESS"] = hybrid("Wind", 50);

export function classifyPdteScale(input: PdteInput): PdteScale {
  const value = input.technology.includes("BESS") || input.technology === "BESS"
    ? input.storageMwh ?? input.installedPowerMw ?? 0
    : input.installedPowerMw ?? 0;
  if (value < 20) return "XS";
  if (value < 100) return "S";
  if (value < 300) return "M";
  if (value < 600) return "L";
  return "XL";
}

function subtractMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const whole = Math.trunc(months);
  result.setUTCMonth(result.getUTCMonth() - whole);
  result.setUTCDate(result.getUTCDate() - Math.round((months - whole) * 30.44));
  return result;
}

function iso(date: Date): string { return date.toISOString().slice(0, 10); }

export function estimateProjectTimeline(input: PdteInput): PdteResult | null {
  const cod = new Date(input.codDate);
  if (Number.isNaN(cod.getTime())) return null;

  const scale = classifyPdteScale(input);
  const stages = TEMPLATES[input.technology].map((stage) => ({ ...stage }));
  const adjustments: string[] = [];
  const addTo = (keys: string[], months: number, reason: string) => {
    if (!months) return;
    for (const stage of stages) if (keys.includes(stage.key)) stage.offset += months;
    adjustments.push(`${reason}: +${months} meses distribuidos`);
  };

  const scaleMonths = { XS: 0, S: 0, M: 2, L: 4, XL: 6 }[scale];
  // Distribute, rather than adding the full factor to every stage.
  addTo(["detalle"], scaleMonths * 0.35, `Escala ${scale}`);
  addTo(["compras"], scaleMonths * 0.35, `Escala ${scale}`);
  addTo(["construccion"], scaleMonths * 0.30, `Escala ${scale}`);

  if (input.environmental === "DIA") addTo(["prefactibilidad", "conceptual", "basica"], 3, "DIA");
  if (input.environmental === "EIA") addTo(["prospeccion", "prefactibilidad", "conceptual", "basica"], 9, "EIA");
  if (input.connectionType === "SUCTD") addTo(["acceso_abierto", "basica"], 2, "SUCTD");

  if (input.newTransmissionLine) {
    const extra = (input.lineLengthKm ?? 0) > 20 ? 6 : 4;
    stages.push(
      { key: "ingenieria_linea", label: "Ingeniería de línea", offset: 20 + extra * 0.35 },
      { key: "servidumbres", label: "Servidumbres", offset: 18 + extra * 0.35 },
      { key: "construccion_linea", label: "Construcción de línea", offset: 10 + extra * 0.30 },
    );
    addTo(["detalle", "construccion"], extra * 0.5, `Nueva línea${(input.lineLengthKm ?? 0) > 20 ? " >20 km" : ""}`);
  }
  if (input.newSubstation) {
    stages.push(
      { key: "ingenieria_subestacion", label: "Ingeniería PAT, protecciones y control", offset: 16.5 },
      { key: "pruebas_subestacion", label: "Pruebas de subestación", offset: 2 },
    );
    addTo(["detalle", "construccion"], 1.5, "Nueva subestación");
  }

  stages.sort((a, b) => b.offset - a.offset);
  const maxOffset = Math.max(...stages.map((stage) => stage.offset));
  const complexity = Number(input.technology.includes("+")) + Number(input.environmental === "EIA") + Number(!!input.newTransmissionLine) + Number(!!input.newSubstation);
  const confidence: PdteConfidence = complexity >= 3 ? "baja" : complexity >= 1 ? "media" : "alta";
  const riskLevel: PdteRisk = maxOffset > 48 || complexity >= 3 ? "alto" : maxOffset > 36 || complexity >= 1 ? "medio" : "bajo";

  const timeline: PdteStage[] = stages.map((stage, index) => {
    const nextOffset = stages[index + 1]?.offset ?? 0;
    return {
      key: stage.key,
      stage: stage.label,
      estimatedStart: iso(subtractMonths(cod, stage.offset)),
      estimatedFinish: iso(subtractMonths(cod, nextOffset)),
      durationMonths: Math.round((stage.offset - nextOffset) * 10) / 10,
      confidence: (stage.offset > 24 ? "baja" : stage.offset > 6 ? "media" : "alta") as PdteConfidence,
    };
  });

  const criticalKeys = input.technology.startsWith("Wind")
    ? ["campana_viento", "wind_assessment", "acceso_abierto", "compras", "construccion", "comisionamiento"]
    : ["acceso_abierto", "detalle", "compras", "construccion", "comisionamiento"];
  if (input.environmental !== "None") criticalKeys.splice(1, 0, "prefactibilidad");
  if (input.newTransmissionLine) criticalKeys.push("servidumbres", "construccion_linea");
  if (input.newSubstation) criticalKeys.push("ingenieria_subestacion", "pruebas_subestacion");

  return {
    technology: input.technology,
    scale,
    timeline,
    criticalPath: timeline.filter((stage) => criticalKeys.includes(stage.key)).map((stage) => stage.stage),
    totalDuration: Math.round(maxOffset * 10) / 10,
    developmentStart: iso(subtractMonths(cod, maxOffset)),
    confidence,
    riskLevel,
    appliedAdjustments: [...new Set(adjustments)],
  };
}
