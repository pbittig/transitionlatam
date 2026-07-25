import { isMarkedHidden, stripAnnotations } from "../shared/client";
import { parseChileanDate, parseChileanNumber, utmToLatLng } from "../shared/utm";
import type { NormalizedCentral, RawCentral } from "./types";

function nullIfEmpty(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed === "" || /^no aplica$/i.test(trimmed) ? null : trimmed;
}

export function normalizeCentral(raw: RawCentral): NormalizedCentral {
  const utmEast = parseChileanNumber(raw.coordenada_este);
  const utmNorth = parseChileanNumber(raw.coordenada_norte);
  const utmZone = nullIfEmpty(raw.zona_huso);

  let latitude: number | null = null;
  let longitude: number | null = null;
  if (utmEast !== null && utmNorth !== null && utmZone) {
    const converted = utmToLatLng(utmEast, utmNorth, utmZone);
    if (converted) {
      latitude = converted.latitude;
      longitude = converted.longitude;
    }
  }

  return {
    idCentral: raw.id_central,
    name: stripAnnotations(raw.central),
    ownerName: nullIfEmpty(raw.propietario) ? stripAnnotations(raw.propietario) : null,
    plantType: nullIfEmpty(raw.tipo_central),
    technologyDetail: nullIfEmpty(raw.tipo_tecnologia),
    energyConversion: nullIfEmpty(raw.tipo_conv_energia),
    isRenewable: nullIfEmpty(raw.conv_ernc) ? raw.conv_ernc.trim().toUpperCase() === "ERNC" : null,
    status: nullIfEmpty(raw.estado),
    installationCode: nullIfEmpty(raw.instalacion),
    connectionPoint: nullIfEmpty(raw.punto_conexion),
    grossMaxPowerMw: parseChileanNumber(raw.pot_max_bruta),
    netCapacityMw: parseChileanNumber(raw.capac_max),
    minTechnicalPowerMw: parseChileanNumber(raw.pot_min_tecnica),
    ownConsumptionMw: parseChileanNumber(raw.cons_propio),
    unitCount: typeof raw.cant_und_gen === "number" ? raw.cant_und_gen : parseChileanNumber(String(raw.cant_und_gen)),
    operationStartDate: parseChileanDate(raw.fecha_ent_oper),
    region: nullIfEmpty(raw.region),
    provincia: nullIfEmpty(raw.provincia),
    comuna: nullIfEmpty(raw.comuna),
    utmZone,
    utmEast,
    utmNorth,
    latitude,
    longitude,
    isHidden: isMarkedHidden(raw.central) || isMarkedHidden(raw.propietario),
  };
}
