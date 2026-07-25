/**
 * Escala de madurez estimada del trámite ambiental SEIA (Servicio de Evaluación
 * Ambiental) — 0 (recién presentado) a 100 (aprobado). Igual que la madurez del
 * trámite de conexión (ver projectStatusMaturity.ts): es una interpretación
 * nuestra del orden típico del proceso (Ley 19.300 / SEIA), no un dato oficial
 * calculado por el SEA — se muestra siempre como estimación.
 */

export type SeiaBand = "inicial" | "calificacion" | "aprobado" | "terminado_negativo";

function normalize(status: string): string {
  return status
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const NEGATIVE_TERMINAL = new Set(
  ["rechazado", "desistido", "no calificado", "no admitida a tramite", "no admitido a tramite"].map(normalize),
);

const STAGE_ORDER: Array<{ statuses: string[]; order: number; band: SeiaBand }> = [
  { statuses: ["en admision", "presentado", "ingresado"], order: 15, band: "inicial" },
  { statuses: ["admitido a tramite", "admitida a tramite"], order: 30, band: "inicial" },
  { statuses: ["en calificacion"], order: 55, band: "calificacion" },
  { statuses: ["aprobado"], order: 100, band: "aprobado" },
];

const LOOKUP = new Map<string, { order: number; band: SeiaBand }>();
for (const stage of STAGE_ORDER) {
  for (const s of stage.statuses) LOOKUP.set(s, { order: stage.order, band: stage.band });
}

export function getSeiaMaturity(status: string | null): { order: number; band: SeiaBand } | null {
  if (!status) return null;
  const key = normalize(status);
  if (NEGATIVE_TERMINAL.has(key)) return null;
  return LOOKUP.get(key) ?? null;
}

export function isSeiaNegativeTerminal(status: string | null): boolean {
  if (!status) return false;
  return NEGATIVE_TERMINAL.has(normalize(status));
}
