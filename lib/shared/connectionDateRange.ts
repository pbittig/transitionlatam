// Compartido entre ConnectionDateRangeFilter.tsx ("use client") y la página server
// que lee sus query params — un archivo "use client" no puede exportar funciones
// invocables desde un Server Component, así que estas viven en un módulo aparte.
export const MONTHS_HORIZON = 24;

export function startOfCurrentMonth(): Date {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function monthOffsetToDate(offset: number): Date {
  const d = startOfCurrentMonth();
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d;
}

export function monthLabel(offset: number): string {
  return monthOffsetToDate(offset).toLocaleDateString("es-CL", { month: "short", year: "2-digit" });
}

/** YYYY-MM-DD del primer día del mes — para el filtro `estimated_connection_date`. */
export function monthOffsetToIso(offset: number): string {
  return monthOffsetToDate(offset).toISOString().slice(0, 10);
}
