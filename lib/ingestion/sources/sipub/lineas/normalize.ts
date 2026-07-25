import type { NormalizedLinea, RawLinea } from "./types";

/** El nivel de tensión viene como sufijo del nombre (ej. "ALTO JAHUEL - MAIPO 220KV") — no hay campo propio. */
function parseVoltageKv(nombre: string): number | null {
  const match = nombre.match(/(\d+(?:[.,]\d+)?)\s*kv/i);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

export function normalizeLinea(raw: RawLinea): NormalizedLinea {
  return {
    idLinea: raw.id,
    nombre: raw.nombre,
    codigoLinea: raw.codigo_linea || null,
    voltageKv: parseVoltageKv(raw.nombre),
    ownerName: raw.nombre_propietario || null,
    coordinadoName: raw.nombre_coordinado || null,
  };
}
