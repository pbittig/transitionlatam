/** Interpretation of the official physical-progress percentage shown in PGP. */
export type PhysicalProgressSignal =
  | "sin_inicio_reportado"
  | "inicio_reportado"
  | "en_ejecucion"
  | "avance_alto"
  | "completado_reportado";

export interface PgpProgressReading {
  percent: number;
  signal: PhysicalProgressSignal;
  constructionStarted: boolean;
  label: string;
}

export const PDTE_PROGRESS_MODEL_VERSION = "pdte-progress-1.0";

/**
 * Expected reported progress between theoretical construction start and COD.
 * Smoothstep is a simple S-curve: slower mobilization/close-out and faster
 * progress through the middle. It is a calibration baseline, not a fact.
 */
export function expectedConstructionProgress(
  constructionStartDate: string,
  codDate: string,
  observedAt: Date = new Date(),
): number | null {
  const start = new Date(constructionStartDate).getTime();
  const finish = new Date(codDate).getTime();
  const observed = observedAt.getTime();
  if (![start, finish, observed].every(Number.isFinite) || finish <= start) return null;
  const elapsedRatio = Math.max(0, Math.min(1, (observed - start) / (finish - start)));
  const sCurve = 3 * elapsedRatio ** 2 - 2 * elapsedRatio ** 3;
  return Math.round(sCurve * 1000) / 10;
}

/**
 * Inverse of the smoothstep S-curve above: given a real (PGP-observed)
 * progress percent, finds the date within [constructionStartDate, codDate]
 * where the theoretical model would have expected that percent. Lets a real
 * percentage be plotted on the same date axis as the theoretical schedule —
 * "how far behind" reads as a calendar gap, not just a percentage gap.
 * Smoothstep is monotonic on [0,1], so bisection is exact enough in a few
 * iterations without needing the closed-form cubic inverse.
 */
export function dateForExpectedProgress(constructionStartDate: string, codDate: string, targetPercent: number): string | null {
  const start = new Date(constructionStartDate).getTime();
  const finish = new Date(codDate).getTime();
  if (![start, finish].every(Number.isFinite) || finish <= start) return null;
  const target = Math.max(0, Math.min(100, targetPercent)) / 100;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const value = 3 * mid ** 2 - 2 * mid ** 3;
    if (value < target) lo = mid;
    else hi = mid;
  }
  return new Date(start + ((lo + hi) / 2) * (finish - start)).toISOString().slice(0, 10);
}

export function interpretPgpProgress(percent: number): PgpProgressReading | null {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null;
  if (percent === 0) {
    return { percent, signal: "sin_inicio_reportado", constructionStarted: false, label: "Sin inicio físico reportado" };
  }
  if (percent < 10) {
    return { percent, signal: "inicio_reportado", constructionStarted: true, label: "Inicio físico reportado" };
  }
  if (percent < 80) {
    return { percent, signal: "en_ejecucion", constructionStarted: true, label: "Construcción en ejecución" };
  }
  if (percent < 100) {
    return { percent, signal: "avance_alto", constructionStarted: true, label: "Construcción con avance alto" };
  }
  return { percent, signal: "completado_reportado", constructionStarted: true, label: "Avance físico completado según PGP" };
}

export function isDeclaredConstructionStatus(status: string | null): boolean {
  const normalized = (status ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  return normalized === "proyecto declarado en construccion" || normalized === "clasificado como obra menor";
}

/**
 * Highlights the commercially relevant gap: administratively complete, but
 * no physical start reported. It is a signal, not proof that works never began.
 */
export function hasConstructionStartGap(status: string | null, progressPercent: number | null): boolean {
  return isDeclaredConstructionStatus(status) && progressPercent === 0;
}

/**
 * ¿El PGP dice que las obras todavía no empezaron?
 *
 * A diferencia de hasConstructionStartGap, no exige que el proyecto esté
 * declarado en construcción: un desarrollador que reporta 0% de avance físico
 * no inició la obra, esté o no declarada. Sirve para que el cronograma no
 * afirme "construcción en curso" por pura aritmética de fechas cuando la
 * fuente dice lo contrario.
 *
 * `null` (sin lectura de PGP) devuelve false a propósito: la ausencia de dato
 * no es dato, y afirmar que no empezó sin fuente violaría la regla de no
 * presentar una estimación como hecho verificado (docs/02-prd.md §2.3).
 */
export function isConstructionNotStartedPerPgp(progressPercent: number | null | undefined): boolean {
  return progressPercent === 0;
}
