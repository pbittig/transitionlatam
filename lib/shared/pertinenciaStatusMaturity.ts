/**
 * Escala de madurez estimada de una Consulta de Pertinencia del SEA — un
 * trámite previo y distinto al ingreso formal a SEIA (ver
 * lib/ingestion/sources/sea-pertinencia). "Resuelta - Ingreso al SEIA" es el
 * término de ESTE trámite, no la aprobación ambiental del proyecto — por eso
 * llega a 100% cuando se resuelve en cualquiera de los dos sentidos.
 *
 * Los valores de estado/subEstado cubiertos son los observados empíricamente
 * en los ~2.243 registros reales cargados (2026-08-05) — ver
 * clasificarConclusionPertinencia en lib/data-access/pertinencias.ts, misma
 * fuente de verdad para qué estados existen realmente.
 */

/**
 * El trámite terminó SIN resolver la situación ambiental: el titular se
 * desistió, lo abandonó, o el SEA no lo admitió. No hay conclusión que mostrar.
 */
const NEGATIVE_TERMINAL_SUBESTADOS = [
  "Resuelta - Desistida",
  "Resuelta - Abandono",
  "Resuelta - No admitida a tramitación",
];

/**
 * El trámite terminó Y resolvió la situación a favor del proyecto: el SEA
 * determinó que no requiere evaluación ambiental.
 *
 * Estaba en la lista de terminales negativos, junto a "Desistida" y "Abandono",
 * y por eso la ficha lo mostraba con la barra vacía como si el proyecto hubiera
 * quedado a medias. Es lo contrario: no hay expediente que encontrar porque el
 * SEA resolvió que no hace falta (ver la referencia de dominio: "Resuelta - No
 * ingreso al SEIA" significa que no se requiere evaluación, no que fracasó).
 */
const FAVORABLE_TERMINAL_SUBESTADOS = ["Resuelta - No ingreso al SEIA"];

function normalize(status: string): string {
  return status
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function getPertinenciaMaturity(estado: string | null, subEstado: string | null): { order: number } | null {
  if (subEstado) {
    const key = normalize(subEstado);
    if (key === normalize("Resuelta - Ingreso al SEIA")) return { order: 100 };
    if (FAVORABLE_TERMINAL_SUBESTADOS.map(normalize).includes(key)) return { order: 100 };
    if (NEGATIVE_TERMINAL_SUBESTADOS.map(normalize).includes(key)) return null;
  }
  if (estado) {
    const key = normalize(estado);
    if (key === normalize("Derivada a SMA")) return { order: 100 };
    if (key === normalize("En análisis") || key === normalize("En análisis-suspendida")) return { order: 40 };
  }
  return null;
}

export function isPertinenciaNegativeTerminal(subEstado: string | null): boolean {
  return !!subEstado && NEGATIVE_TERMINAL_SUBESTADOS.map(normalize).includes(normalize(subEstado));
}

/** El trámite cerró resolviendo que el proyecto no requiere evaluación ambiental. */
export function isPertinenciaFavorableTerminal(subEstado: string | null): boolean {
  return !!subEstado && FAVORABLE_TERMINAL_SUBESTADOS.map(normalize).includes(normalize(subEstado));
}
