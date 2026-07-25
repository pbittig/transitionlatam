/**
 * Escala de madurez estimada del proceso de conexión chileno (SAC — Solicitud de
 * Acceso y Conexión), de 0 (recién ingresada) a 100 (declarada en construcción o
 * finalizada). Es una interpretación nuestra del orden típico del trámite ante el
 * Coordinador Eléctrico Nacional, no un dato oficial del Coordinador — se muestra
 * siempre etiquetada como estimación (ver docs/04-modelo-datos.md §4.3, mismo
 * principio que la fase estimada de desarrollo). El texto original del estado
 * nunca se reemplaza, solo se usa para calcular la posición en la barra.
 *
 * La fuente mezcla variantes de mayúsculas/typos para el mismo estado real (ej.
 * "Proyecto declarado en construcción" / "...construccion" / "...Construcción");
 * la normalización agrupa esas variantes sin alterar el texto mostrado al usuario.
 */

export type StatusBand = "inicial" | "evaluacion" | "avanzado" | "construccion" | "finalizado" | "terminado_negativo";

export interface StatusMaturity {
  order: number; // 0-100
  band: StatusBand;
}

function normalize(status: string): string {
  return status
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const REJECTED = new Set(["rechazada", "desistida"].map(normalize));

// Orden aproximado de menor a mayor madurez — agrupado por etapa real del trámite.
const STAGE_ORDER: Array<{ statuses: string[]; order: number; band: StatusBand }> = [
  { statuses: ["solicitud ingresada", "proyecto ingresado"], order: 8, band: "inicial" },
  { statuses: ["evaluacion admisibilidad"], order: 15, band: "inicial" },
  { statuses: ["desarrollo de estudios y/o antecedentes"], order: 20, band: "inicial" },
  { statuses: ["revision de antecedentes", "evaluacion de antecedentes y/o requerimientos"], order: 28, band: "evaluacion" },
  { statuses: ["elaboracion informe ctd preliminar", "elaboracion informe de autorizacion de conexion preliminar"], order: 36, band: "evaluacion" },
  {
    statuses: ["observaciones al informe ctd preliminar", "observaciones a informe de autorizacion de conexion preliminar"],
    order: 44,
    band: "evaluacion",
  },
  { statuses: ["audiencia y antecedentes adicionales", "periodo de presentacion de discrepancias"], order: 52, band: "evaluacion" },
  { statuses: ["proyecto fehaciente debe presentar suctd", "proyecto calificado como fehaciente"], order: 60, band: "avanzado" },
  {
    statuses: [
      "elaboracion de informe de autorizacion de conexion final",
      "elaboracion de informe de autorizacion de conexion proyecto fehaciente",
    ],
    order: 70,
    band: "avanzado",
  },
  { statuses: ["proyecto autorizado para declararse en construccion"], order: 82, band: "avanzado" },
  {
    statuses: [
      "detenida a la espera de definicion de ingenieria de la obra",
      "detenida a la espera de informacion tecnica del propietario de la instalacion",
    ],
    order: 78,
    band: "avanzado",
  },
  { statuses: ["proyecto declarado en construccion", "clasificado como obra menor"], order: 92, band: "construccion" },
  { statuses: ["proyecto finalizado"], order: 100, band: "finalizado" },
];

const LOOKUP = new Map<string, { order: number; band: StatusBand }>();
for (const stage of STAGE_ORDER) {
  for (const s of stage.statuses) LOOKUP.set(s, { order: stage.order, band: stage.band });
}

/** null si el estado es un terminal negativo (Rechazada/Desistida) — no aplica escala de madurez. */
export function getStatusMaturity(status: string | null): StatusMaturity | null {
  if (!status) return null;
  const key = normalize(status);
  if (REJECTED.has(key)) return null;
  const hit = LOOKUP.get(key);
  return hit ? { order: hit.order, band: hit.band } : null;
}

export function isRejectedStatus(status: string | null): boolean {
  if (!status) return false;
  return REJECTED.has(normalize(status));
}

export const STATUS_BAND_LABEL: Record<StatusBand, string> = {
  inicial: "Etapa inicial",
  evaluacion: "En evaluación técnica",
  avanzado: "Etapa avanzada",
  construccion: "En construcción",
  finalizado: "Finalizado",
  terminado_negativo: "Rechazado / desistido",
};
