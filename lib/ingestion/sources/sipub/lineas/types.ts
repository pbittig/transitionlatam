export interface RawLinea {
  id: number;
  nombre: string;
  id_centro_control: number;
  nombre_centro_control: string;
  nombre_propietario: string;
  id_propietario: number;
  id_coordinado: number;
  nombre_coordinado: string;
  codigo_linea: string;
  numero_linea: number;
  nemotecnico: string;
  descripcion: string;
}

export interface LineasPage {
  data: RawLinea[];
  totalPages: number;
  page: number;
}

export interface NormalizedLinea {
  idLinea: number;
  nombre: string;
  codigoLinea: string | null;
  voltageKv: number | null;
  ownerName: string | null;
  coordinadoName: string | null;
}
