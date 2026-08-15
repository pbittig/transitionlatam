/**
 * Muestra una columna `date` de Postgres tal cual, sin pasarla por husos horarios.
 *
 * EL BUG QUE CORRIGE: `new Date("2026-06-01")` se interpreta como medianoche
 * UTC, y `toLocaleDateString("es-CL")` la traduce a hora de Chile (UTC-4), o sea
 * las 20:00 del 31 de mayo. Resultado: **toda fecha de conexión se mostraba un
 * día antes de lo guardado**. Detectado el 2026-08-15 en /admin/verificador,
 * donde un proyecto guardado como 2026-06-01 aparecía como 31-05-2026 dentro
 * del Pack 1, que empieza justamente el 1 de junio — parecía un filtro roto y
 * era el formateo.
 *
 * `estimated_connection_date` es `date`, no `timestamptz`: no representa un
 * instante sino un día del calendario. Convertirlo entre husos no es un ajuste,
 * es una corrupción — el día que el desarrollador declaró no cambia porque
 * quien mira esté en otro país.
 *
 * NO usar esto para timestamps (`verified_at`, `created_at`, `occurred_at`):
 * esos sí son instantes y ahí la conversión a hora local es lo correcto.
 */
export function formatDateOnly(value: string | null | undefined, locale: "es" | "en" = "es"): string | null {
  if (!value) return null;
  // Se parte el texto en vez de construir un Date: cualquier Date obliga a
  // elegir un huso, y acá no hay ninguno que elegir.
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return null;
  return locale === "en" ? `${day}/${month}/${year}` : `${day}-${month}-${year}`;
}
