/**
 * Cuándo un proyecto está legalmente obligado a tener un antecedente
 * ambiental (DIA/EIA o, para BESS, revisar si sus obras asociadas lo
 * requieren) — para que Health Score sepa distinguir "sin antecedente
 * porque no aplica" de "sin antecedente pese a que la ley lo exige".
 * Editado a mano aquí, no en projectHealthScore.ts, mismo criterio que
 * projectPhaseDurations.ts — son supuestos regulatorios que cambian con
 * reformas (ver DS 40/2012 y su modificación DS 17/2025), no lógica de
 * producto.
 *
 * Fuentes (verificadas 2026-08-08):
 * - Generación >3 MW: ingreso obligatorio al SEIA — art. 3 letra c) del
 *   Reglamento del SEIA (DS 40/2012), sobre "centrales generadoras de
 *   energía mayores a 3 MW". No confundir con el umbral PMGD (9 MW,
 *   Reglamento MGPE) — ese clasifica el tipo de conexión, no si requiere
 *   DIA/EIA; un proyecto puede ser PMGD y tener ingreso SEIA obligatorio
 *   a la vez.
 * - BESS standalone: no es una "central generadora", por lo que no tiene
 *   ingreso automático al SEIA por esa categoría (Resolución SEA
 *   202399101970). Pero sus obras asociadas —líneas de transmisión o
 *   subestaciones sobre 23 kV— sí pueden gatillar SEIA por la categoría
 *   de líneas de transmisión de alto voltaje.
 */

/** MW de capacidad de generación sobre los cuales el ingreso a SEIA es obligatorio. */
export const SEIA_MANDATORY_GENERATION_THRESHOLD_MW = 3;

/** kV de la conexión de un BESS standalone sobre los cuales sus obras asociadas pueden requerir SEIA. */
export const SEIA_MANDATORY_BESS_VOLTAGE_THRESHOLD_KV = 23;

/** "220", "23 kV", "23,0" → 220 / 23 / 23; null si no es parseable. */
export function parseVoltageKv(voltageLevel: string | null | undefined): number | null {
  if (!voltageLevel) return null;
  const match = voltageLevel.replace(",", ".").match(/[\d.]+/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

/**
 * true si, según lo que sabemos del proyecto, la ley debería exigirle un
 * antecedente ambiental (DIA/EIA) — independientemente de si ya lo tiene.
 * `isStandaloneBess` debe venir del mismo criterio que ya usa
 * projectHealthScore.ts (projectKind === "storage").
 */
export function requiresEnvironmentalReview(params: {
  isStandaloneBess: boolean;
  generationCapacityMw: number | null;
  voltageLevelKv: number | null;
}): boolean {
  if (params.isStandaloneBess) {
    return params.voltageLevelKv !== null && params.voltageLevelKv > SEIA_MANDATORY_BESS_VOLTAGE_THRESHOLD_KV;
  }
  return params.generationCapacityMw !== null && params.generationCapacityMw > SEIA_MANDATORY_GENERATION_THRESHOLD_MW;
}
