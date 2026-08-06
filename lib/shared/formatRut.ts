/**
 * Formato único de RUT chileno para mostrar en pantalla — "77.748.009-K". El
 * dato en la base queda tal cual está guardado (con o sin puntos, según la
 * fuente); esto es solo de presentación, nunca se usa para comparar/cruzar
 * (para eso ver normalizeRutDigits en lib/ingestion/sources/sea-pertinencia/matching.ts).
 */
export function formatRutForDisplay(rut: string | null | undefined): string | null {
  if (!rut) return null;
  const clean = rut.toUpperCase().replace(/[^0-9K]/g, "");
  if (clean.length < 2) return rut;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const bodyWithDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${bodyWithDots}-${dv}`;
}
