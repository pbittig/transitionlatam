import ExcelJS from "exceljs";
import type { RawSolicitudRow } from "./types";

const COLUMN_MAP: Record<string, keyof RawSolicitudRow> = {
  Id: "id",
  Proyecto: "proyecto",
  NUP: "nup",
  "Empresa Solicitante": "empresaSolicitante",
  Tipo: "tipo",
  "Estado Solicitud": "estadoSolicitud",
  "Fecha Recepción": "fechaRecepcion",
  "Capacidad [MW]": "capacidadMw",
  "Tipo Proyecto": "tipoProyecto",
  "Tipo Tecnologia": "tipoTecnologia",
  "Potencia Neta Solicitada de Inyección [MW]": "potenciaNetaInyeccionMw",
  "Potencia Neta Solicitada de Retiro [MW]": "potenciaNetaRetiroMw",
  "Potencia de Generación [MW]": "potenciaGeneracionMw",
  "Potencia de Almacenamiento [MW]": "potenciaAlmacenamientoMw",
  "Energia [MWh]": "energiaMwh",
  "Horas de Almacenamiento [h]": "horasAlmacenamiento",
  "Fecha Estimada Conexión": "fechaEstimadaConexion",
  "Punto de Conexión": "puntoConexion",
  "Nivel de tension": "nivelTension",
  Barra: "barra",
  Paño: "pano",
  Región: "region",
  Comuna: "comuna",
  "Segmento de Transmisión": "segmentoTransmision",
};

const NUMERIC_FIELDS = new Set<keyof RawSolicitudRow>([
  "id",
  "capacidadMw",
  "potenciaNetaInyeccionMw",
  "potenciaNetaRetiroMw",
  "potenciaGeneracionMw",
  "potenciaAlmacenamientoMw",
  "energiaMwh",
  "horasAlmacenamiento",
]);

function cellToString(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function cellToNumber(value: ExcelJS.CellValue): number | null {
  const s = cellToString(value);
  if (s === null) return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

export async function parseSolicitudesFile(filePath: string): Promise<RawSolicitudRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  const headerRow = sheet.getRow(1);
  const colIndexToField = new Map<number, keyof RawSolicitudRow>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const header = cellToString(cell.value);
    if (header && COLUMN_MAP[header]) {
      colIndexToField.set(colNumber, COLUMN_MAP[header]);
    }
  });

  const rows: RawSolicitudRow[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const partial: Partial<Record<keyof RawSolicitudRow, string | number | null>> = {};
    for (const [colIndex, field] of colIndexToField) {
      const value = row.getCell(colIndex).value;
      partial[field] = NUMERIC_FIELDS.has(field) ? cellToNumber(value) : cellToString(value);
    }

    if (partial.id === null || partial.id === undefined) return;

    rows.push({
      id: partial.id as number,
      proyecto: (partial.proyecto as string) ?? "",
      nup: (partial.nup as string) ?? null,
      empresaSolicitante: (partial.empresaSolicitante as string) ?? "",
      tipo: (partial.tipo as string) ?? null,
      estadoSolicitud: (partial.estadoSolicitud as string) ?? "",
      fechaRecepcion: (partial.fechaRecepcion as string) ?? null,
      capacidadMw: (partial.capacidadMw as number) ?? null,
      tipoProyecto: (partial.tipoProyecto as string) ?? null,
      tipoTecnologia: (partial.tipoTecnologia as string) ?? null,
      potenciaNetaInyeccionMw: (partial.potenciaNetaInyeccionMw as number) ?? null,
      potenciaNetaRetiroMw: (partial.potenciaNetaRetiroMw as number) ?? null,
      potenciaGeneracionMw: (partial.potenciaGeneracionMw as number) ?? null,
      potenciaAlmacenamientoMw: (partial.potenciaAlmacenamientoMw as number) ?? null,
      energiaMwh: (partial.energiaMwh as number) ?? null,
      horasAlmacenamiento: (partial.horasAlmacenamiento as number) ?? null,
      fechaEstimadaConexion: (partial.fechaEstimadaConexion as string) ?? null,
      puntoConexion: (partial.puntoConexion as string) ?? null,
      nivelTension: (partial.nivelTension as string) ?? null,
      barra: (partial.barra as string) ?? null,
      pano: (partial.pano as string) ?? null,
      region: (partial.region as string) ?? null,
      comuna: (partial.comuna as string) ?? null,
      segmentoTransmision: (partial.segmentoTransmision as string) ?? null,
    });
  });

  return rows;
}
