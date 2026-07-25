import proj4 from "proj4";

/**
 * Convierte coordenadas UTM (huso chileno, siempre hemisferio sur) a WGS84 lat/lng.
 * `zonaHuso` viene de la fuente en formatos variados ("19G", "19 H", "19S", "19"),
 * donde la letra es la banda de latitud MGRS (no el hemisferio) — Chile continental
 * está siempre en el hemisferio sur, así que solo se extrae el número de huso (18/19/20).
 */
export function utmToLatLng(
  utmEast: number,
  utmNorth: number,
  zonaHuso: string,
): { latitude: number; longitude: number } | null {
  const match = zonaHuso.match(/(\d{1,2})/);
  if (!match) return null;
  const zone = Number(match[1]);
  if (zone < 1 || zone > 60) return null;

  const utmDef = `+proj=utm +zone=${zone} +south +datum=WGS84 +units=m +no_defs`;
  const [longitude, latitude] = proj4(utmDef, "WGS84", [utmEast, utmNorth]);
  return { latitude, longitude };
}

/**
 * Parsea números numéricos de la fuente, que mezcla dos formatos reales sin aviso:
 * formato chileno con coma decimal ("2,96" -> 2.96, "." es separador de miles) y
 * formato con punto decimal simple sin separador de miles ("4.97" -> 4.97, visto
 * en el mismo campo `capac_max` para otras centrales). Solo se interpreta el "."
 * como separador de miles cuando también hay una coma en el valor — si no, el "."
 * ya es el punto decimal y no se toca (evita inflar "4.97" a 497, error real
 * detectado la primera vez que se cargaron datos: totales de capacidad ~50x
 * mayores a lo esperado para Chile).
 */
export function parseChileanNumber(input: string | null | undefined): number | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Parsea fechas "DD-MM-YYYY" -> ISO "YYYY-MM-DD" ("" -> null). */
export function parseChileanDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const match = input.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}
