import { normalizeForMatch } from "../../energia-abierta/listado/normalize";
import { parseChileanNumber } from "../shared/utm";
import type { RawTransformador2d, SubstationAggregate } from "./types";

function nullIfEmpty(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed === "" || /^no aplica$/i.test(trimmed) ? null : trimmed;
}

/** Agrupa transformadores individuales en subestaciones — no existe la subestación como entidad propia en la API. */
export function aggregateSubstations(transformers: RawTransformador2d[]): SubstationAggregate[] {
  const byName = new Map<
    string,
    { name: string; owner: string | null; count: number; capacitySum: number; voltageLevels: Set<string> }
  >();

  for (const t of transformers) {
    const name = nullIfEmpty(t.nombre_subestacion);
    if (!name) continue;
    const key = normalizeForMatch(name);

    if (!byName.has(key)) {
      byName.set(key, { name, owner: nullIfEmpty(t.nombre_propietario), count: 0, capacitySum: 0, voltageLevels: new Set() });
    }
    const agg = byName.get(key)!;
    agg.count += 1;

    const capacity = parseChileanNumber(t.cap_nom_at);
    if (capacity !== null) agg.capacitySum += capacity;

    const at = nullIfEmpty(t.tension_nominal_at);
    const bt = nullIfEmpty(t.tension_nominal_bt);
    if (at && bt) agg.voltageLevels.add(`${at}/${bt} kV`);
  }

  return [...byName.entries()].map(([nameNormalized, agg]) => ({
    name: agg.name,
    nameNormalized,
    ownerName: agg.owner,
    transformerCount: agg.count,
    totalCapacityMva: agg.count > 0 ? agg.capacitySum : null,
    voltageLevels: [...agg.voltageLevels].join(", "),
  }));
}
