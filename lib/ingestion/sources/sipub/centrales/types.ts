export interface RawCentral {
  central: string;
  propietario: string;
  tipo_central: string;
  id_central: number;
  instalacion: string;
  coordinado: string;
  centro_control: string;
  estado: string;
  cant_und_gen: number | string;
  punto_conexion: string;
  pot_max_bruta: string;
  cons_propio: string;
  capac_max: string;
  pot_min_tecnica: string;
  fecha_ent_oper: string;
  tipo_conv_energia: string;
  conv_ernc: string;
  combus_termo: string;
  tipo_tecnologia: string;
  region: string;
  provincia: string;
  comuna: string;
  zona_huso: string;
  coordenada_este: string;
  coordenada_norte: string;
}

export interface CentralesPage {
  totalPages: number;
  data: RawCentral[];
}

export interface NormalizedCentral {
  idCentral: number;
  name: string;
  ownerName: string | null;
  plantType: string | null;
  technologyDetail: string | null;
  energyConversion: string | null;
  isRenewable: boolean | null;
  status: string | null;
  installationCode: string | null;
  connectionPoint: string | null;
  grossMaxPowerMw: number | null;
  netCapacityMw: number | null;
  minTechnicalPowerMw: number | null;
  ownConsumptionMw: number | null;
  unitCount: number | null;
  operationStartDate: string | null; // ISO date
  region: string | null;
  provincia: string | null;
  comuna: string | null;
  utmZone: string | null;
  utmEast: number | null;
  utmNorth: number | null;
  latitude: number | null;
  longitude: number | null;
  isHidden: boolean;
}
