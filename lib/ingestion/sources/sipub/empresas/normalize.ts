import { normalizeForMatch } from "../../energia-abierta/listado/normalize";
import { isMarkedHidden, stripAnnotations } from "../shared/client";
import type { NormalizedEmpresa, RawEmpresa } from "./types";

export function normalizeEmpresa(raw: RawEmpresa): NormalizedEmpresa {
  const cleanName = stripAnnotations(raw.nombre);
  return {
    idInfotecnica: raw.id_infotecnica,
    nombre: cleanName,
    nameNormalized: normalizeForMatch(cleanName),
    grupo: raw.grupo,
    giro: raw.giro,
    mnemotecnico: raw.mnemotecnico,
    numero: raw.numero,
    descripcion: raw.descripcion,
    isHidden: isMarkedHidden(raw.nombre),
  };
}
