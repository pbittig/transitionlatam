/**
 * "¿Este proyecto avanza o está parado?" — la pregunta que un desarrollador o un
 * inversionista se hace primero mirando una ficha, y que hasta ahora no se
 * respondía en ninguna parte: un proyecto autorizado hace dos años sin
 * movimiento y uno que cambió de estado ayer se veían idénticos.
 *
 * Se arma con dos hechos que ya están en `project_event`, sin dato nuevo:
 *
 * 1. La fecha real de ingreso de la solicitud al Coordinador — el evento
 *    `announced` guarda `receivedAt` de la fuente, no nuestra fecha de
 *    detección (ver listado/load.ts). Hay 2.253, el más antiguo de 2017.
 * 2. El último movimiento registrado, que NO es `announced`: cambios de estado
 *    del trámite, hitos SEIA, cambios de fecha de conexión.
 *
 * Límite que hay que declarar en la UI: sólo observamos cambios desde que el
 * pipeline empezó a correr (2026-07-20). Que no haya movimiento registrado no
 * significa que el proyecto esté detenido — significa que no lo vimos moverse.
 */

export interface ProjectPulseEvent {
  eventType: string;
  occurredAt: string;
  description: string | null;
}

export interface ProjectPulse {
  /** Ingreso de la solicitud ante el Coordinador, según la fuente. */
  requestedAt: string | null;
  /** Meses transcurridos desde el ingreso — null si no hay fecha. */
  requestAgeMonths: number | null;
  /** Último movimiento distinto del ingreso, si lo observamos. */
  lastMovement: ProjectPulseEvent | null;
}

const MS_PER_DAY = 86_400_000;
const DAYS_PER_MONTH = 30.44;

export function computeProjectPulse(events: ProjectPulseEvent[], now: Date = new Date()): ProjectPulse {
  const announced = events.filter((event) => event.eventType === "announced").map((event) => event.occurredAt).sort();
  const requestedAt = announced[0] ?? null;

  // Los eventos vienen ordenados por fecha desde getProjectTimeline, pero no se
  // asume: un `sort` sobre pocos elementos es más barato que un bug silencioso.
  const movements = events
    .filter((event) => event.eventType !== "announced")
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const requestAgeMonths = requestedAt
    ? Math.max(0, Math.round((now.getTime() - new Date(requestedAt).getTime()) / MS_PER_DAY / DAYS_PER_MONTH))
    : null;

  return { requestedAt, requestAgeMonths, lastMovement: movements[0] ?? null };
}

/** "3 años 7 meses", "8 meses", "menos de un mes". */
export function formatMonthSpan(months: number, locale: "es" | "en"): string {
  if (months < 1) return locale === "en" ? "less than a month" : "menos de un mes";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(locale === "en" ? `${years} year${years === 1 ? "" : "s"}` : `${years} año${years === 1 ? "" : "s"}`);
  if (rest > 0) parts.push(locale === "en" ? `${rest} month${rest === 1 ? "" : "s"}` : `${rest} ${rest === 1 ? "mes" : "meses"}`);
  return parts.join(locale === "en" ? " " : " ");
}

/** "ayer", "hace 3 días", "hace 2 meses" — para el último movimiento. */
export function formatTimeAgo(isoDate: string, locale: "es" | "en", now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(isoDate).getTime()) / MS_PER_DAY);
  if (days <= 0) return locale === "en" ? "today" : "hoy";
  if (days === 1) return locale === "en" ? "yesterday" : "ayer";
  if (days < 30) return locale === "en" ? `${days} days ago` : `hace ${days} días`;
  const months = Math.round(days / DAYS_PER_MONTH);
  if (months < 12) return locale === "en" ? `${months} month${months === 1 ? "" : "s"} ago` : `hace ${months} ${months === 1 ? "mes" : "meses"}`;
  return locale === "en" ? `over a year ago` : "hace más de un año";
}
