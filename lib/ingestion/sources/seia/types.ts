export interface RawSeiaProject {
  EXPEDIENTE_ID: string;
  EXPEDIENTE_NOMBRE: string;
  EXPEDIENTE_URL_PPAL: string;
  EXPEDIENTE_URL_FICHA: string;
  WORKFLOW_DESCRIPCION: string; // "EIA" / "DIA"
  REGION_NOMBRE: string;
  COMUNA_NOMBRE: string;
  TIPO_PROYECTO: string; // código corto, ej. "c" = centrales generadoras >3MW
  DESCRIPCION_TIPOLOGIA: string;
  RAZON_INGRESO: string;
  TITULAR: string;
  INVERSION_MM: string;
  INVERSION_MM_FORMAT: string;
  FECHA_PRESENTACION: string; // epoch seconds, string
  FECHA_PRESENTACION_FORMAT: string;
  ESTADO_PROYECTO: string; // estado de la evaluación ambiental
}

export interface SeiaSearchResponse {
  status: boolean;
  data: RawSeiaProject[];
  recordsTotal: number;
  recordsFiltered: number;
}
