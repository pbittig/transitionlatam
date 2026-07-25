export interface RawTransformador2d {
  id: number;
  nombre: string;
  nombre_propietario: string;
  nombre_subestacion: string;
  nombre_pano: string;
  tension_nominal_at: string; // kV, string numérico formato chileno
  tension_nominal_bt: string;
  cap_nom_at: string; // MVA, string numérico formato chileno
  estado_equipo_transf: string;
}

export interface Transformadores2dPage {
  data: RawTransformador2d[];
  totalPages: number;
  page: number;
}

export interface SubstationAggregate {
  name: string;
  nameNormalized: string;
  ownerName: string | null;
  transformerCount: number;
  totalCapacityMva: number | null;
  voltageLevels: string; // ej. "230/23 kV, 110/23 kV" — niveles distintos observados
}
