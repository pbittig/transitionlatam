export interface RawEmpresa {
  barra_set: string[];
  central_set: string[];
  linea_set: string[];
  subestacion_set: string[];
  paño_set: string[];
  rut: string | null;
  id_infotecnica: number;
  giro: number | null;
  grupo: number | null;
  nombre: string;
  descripcion: string | null;
  mnemotecnico: string | null;
  numero: number | null;
}

export interface EmpresasPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: RawEmpresa[];
}

export interface NormalizedEmpresa {
  idInfotecnica: number;
  nombre: string;
  nameNormalized: string;
  grupo: number | null;
  giro: number | null;
  mnemotecnico: string | null;
  numero: number | null;
  descripcion: string | null;
  isHidden: boolean;
}
