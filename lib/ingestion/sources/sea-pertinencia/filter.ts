import type { RawPertinenciaListItem } from "./fetchFromApi";

/**
 * Mismo alcance editorial que el resto de la plataforma (renovables + BESS,
 * ver lib/ingestion/sources/energia-abierta/listado/prefilter.ts) — palabras
 * clave sobre nombre del proyecto y tipología, únicas señales disponibles en
 * el listado (el detalle completo trae más contexto pero solo se pide para
 * los que ya pasaron este filtro, no para las ~26k filas).
 */
const KEYWORDS = [
  "bess",
  "battery energy storage",
  "sistema de almacenamiento de energía",
  "almacenamiento de energía",
  "almacenamiento electroquímico",
  "solar",
  "fotovoltaic",
  "eólic",
  "eolic",
].map((k) => k.toLowerCase());

export function isRelevantPertinencia(row: RawPertinenciaListItem): boolean {
  const haystack = `${row.name} ${row.primaryTypologyName ?? ""}`.toLowerCase();
  return KEYWORDS.some((k) => haystack.includes(k));
}
