import ExcelJS from "exceljs";
import type {
  FormularioConsistencyIssue,
  FormularioContact,
  FormularioData,
  FormularioLocation,
  FormularioVerification,
} from "./types";

const LABEL_COL = 2; // B — donde vive la etiqueta de cada campo
const VALUE_COL = 7; // G — donde vive el valor en la plantilla FORM-SAC-V1

function cellText(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const v = value as { richText?: Array<{ text: string }>; text?: unknown; result?: unknown };
    if (v.richText) return v.richText.map((t) => t.text).join("").trim() || null;
    if (v.text !== undefined) return String(v.text).trim() || null; // hyperlink { text, hyperlink }
    if (v.result !== undefined) return String(v.result).trim() || null; // fórmula { formula, result }
    return null;
  }
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function cellNumber(value: ExcelJS.CellValue): number | null {
  const s = cellText(value);
  if (s === null) return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

function extractIsoDate(value: ExcelJS.CellValue): string | null {
  const s = cellText(value);
  if (!s) return null;
  const match = s.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

/** Mapa etiqueta → valor para filas donde la columna B es la etiqueta y G el valor real. */
function buildLabelMap(ws: ExcelJS.Worksheet): Map<string, ExcelJS.CellValue> {
  const map = new Map<string, ExcelJS.CellValue>();
  ws.eachRow({ includeEmpty: false }, (row) => {
    const label = cellText(row.getCell(LABEL_COL).value);
    if (!label) return;
    const value = row.getCell(VALUE_COL).value;
    const valueText = cellText(value);
    if (valueText === null || valueText === label) return; // fila de encabezado/sección, no un campo
    map.set(label, value);
  });
  return map;
}

/**
 * La pestaña rica NO siempre se llama "FORMULARIO SAC" — es el nombre de la
 * plantilla del tipo de solicitud (hallazgo real: un Excel "Fehaciente" trae
 * su pestaña como "FORMULARIO FEH"; una pestaña oculta del mismo archivo
 * enumera al menos 4 tipos — SAC, SUCTD, Obra Menor, Fehaciente — así que
 * hardcodear un solo nombre deja afuera al resto). Se detecta por contenido
 * en vez de por nombre: la pestaña rica es la que tiene "Razón Social (1)"
 * en la columna de etiquetas — ese campo es el primero y es igual en todas
 * las variantes de plantilla vistas hasta ahora.
 */
function findFormularioWorksheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet | null {
  for (const ws of workbook.worksheets) {
    let hasRazonSocial = false;
    ws.eachRow({ includeEmpty: false }, (row) => {
      if (hasRazonSocial) return;
      if (cellText(row.getCell(LABEL_COL).value) === "Razón Social (1)") hasRazonSocial = true;
    });
    if (hasRazonSocial) return ws;
  }
  return null;
}

function findRowNumberByLabel(ws: ExcelJS.Worksheet, label: string): number | null {
  let found: number | null = null;
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (found !== null) return;
    if (cellText(row.getCell(LABEL_COL).value) === label) found = rowNumber;
  });
  return found;
}

function findRowMatching(ws: ExcelJS.Worksheet, pattern: RegExp): number | null {
  let found: number | null = null;
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (found !== null) return;
    const label = cellText(row.getCell(LABEL_COL).value);
    if (label && pattern.test(label)) found = rowNumber;
  });
  return found;
}

/**
 * Extracción posicional de contactos — NO usa el mapa plano de etiquetas
 * (buildLabelMap) porque plantillas antiguas (hallazgo real: "Versión
 * 25-05-21", proyecto "Parque Eólico Esmeralda" / Colbún) repiten la misma
 * etiqueta genérica ("e-mail", "Nombre coordinador de proyecto (3)") para el
 * representante legal y ambos coordinadores, sin el sufijo "primer"/"segundo"
 * que sí trae la plantilla nueva (2504-FORM-*-V1) — un Map<etiqueta,valor> las
 * va pisando entre sí y termina asignando el email del último contacto leído
 * a los tres roles. Aquí se ancla en los encabezados de sección y se camina
 * fila por fila en orden: dentro de "Contacto de Representante Legal" el
 * primer "Nombre.../e-mail.../Teléfono..." que aparece es del representante;
 * dentro de "Coordinadores de proyecto(s)" cada fila "Nombre..." abre un
 * contacto nuevo (1° = coordinador 1, 2° = coordinador 2), y las filas
 * "e-mail.../Teléfono..." siguientes le pertenecen hasta la próxima "Nombre...".
 */
function parseContactsBlock(ws: ExcelJS.Worksheet): FormularioContact[] {
  const repHeaderRow = findRowNumberByLabel(ws, "Contacto de Representante Legal");
  const coordHeaderRow = findRowMatching(ws, /^Coordinadores de proyecto/i);
  if (!repHeaderRow || !coordHeaderRow) return [];
  const sectionEndRow = findRowMatching(ws, /^Antecedentes del Proyecto/i) ?? ws.rowCount + 1;

  const contacts: FormularioContact[] = [];

  let legalName: string | null = null;
  let legalEmail: string | null = null;
  let legalPhone: string | null = null;
  for (let r = repHeaderRow + 1; r < coordHeaderRow; r++) {
    const row = ws.getRow(r);
    const label = cellText(row.getCell(LABEL_COL).value);
    if (!label) continue;
    const value = cellText(row.getCell(VALUE_COL).value);
    if (/^Nombre/i.test(label)) legalName = value;
    else if (/^e-?mail/i.test(label)) legalEmail = value;
    else if (/^Tel[ée]fono/i.test(label)) legalPhone = value;
  }
  if (legalName) contacts.push({ role: "legal_representative", name: legalName, email: legalEmail, phone: legalPhone });

  const coordRoles: FormularioContact["role"][] = ["project_coordinator_1", "project_coordinator_2"];
  type CoordDraft = { name: string | null; email: string | null; phone: string | null };
  const coordinators: CoordDraft[] = [];
  let current: CoordDraft | null = null;
  for (let r = coordHeaderRow + 1; r < sectionEndRow; r++) {
    const row = ws.getRow(r);
    const label = cellText(row.getCell(LABEL_COL).value);
    if (!label) continue;
    const value = cellText(row.getCell(VALUE_COL).value);
    if (/^Nombre/i.test(label)) {
      current = { name: value, email: null, phone: null };
      coordinators.push(current);
    } else if (/^e-?mail/i.test(label) && current) {
      current.email = value;
    } else if (/^Tel[ée]fono/i.test(label) && current) {
      current.phone = value;
    }
  }
  coordinators.slice(0, 2).forEach((c, i) => {
    if (c.name) contacts.push({ role: coordRoles[i], name: c.name, email: c.email, phone: c.phone });
  });

  return contacts;
}

/**
 * Bloque "Ubicación Geográfica..." de la plantilla: 2 filas después del encabezado
 * vienen Huso/Este/Norte, y 1 fila más abajo, Comuna/Región — mismo patrón para
 * la ubicación del proyecto y la del punto de conexión.
 */
function parseLocationBlock(ws: ExcelJS.Worksheet, headerLabel: string): FormularioLocation {
  const empty: FormularioLocation = { utmZone: null, utmEast: null, utmNorth: null, comuna: null, region: null };
  const headerRow = findRowNumberByLabel(ws, headerLabel);
  if (!headerRow) return empty;

  const coordRow = ws.getRow(headerRow + 2);
  const comunaRow = ws.getRow(headerRow + 3);

  return {
    utmZone: cellText(coordRow.getCell(3).value),
    utmEast: cellNumber(coordRow.getCell(5).value),
    utmNorth: cellNumber(coordRow.getCell(7).value),
    comuna: cellText(comunaRow.getCell(3).value),
    region: cellText(comunaRow.getCell(7).value),
  };
}

/**
 * "Potencia [MW]" aparece dos veces (componente generación y componente de
 * almacenamiento) — un Map por etiqueta no sirve ahí, se lee por offset desde
 * el encabezado de cada sección.
 */
function valueAfterHeader(ws: ExcelJS.Worksheet, headerLabel: string, rowOffset = 1): ExcelJS.CellValue {
  const headerRow = findRowNumberByLabel(ws, headerLabel);
  if (!headerRow) return null;
  return ws.getRow(headerRow + rowOffset).getCell(VALUE_COL).value;
}

export async function parseFormularioExcel(filePath: string): Promise<FormularioData> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const ws = findFormularioWorksheet(workbook);
  if (!ws) {
    const sheetNames = workbook.worksheets.map((s) => s.name).join(", ");
    throw new Error(`No se encontró una pestaña con "Razón Social (1)" en el archivo (pestañas presentes: ${sheetNames})`);
  }

  const map = buildLabelMap(ws);
  const get = (label: string) => cellText(map.get(label) ?? null);
  const getNum = (label: string) => cellNumber(map.get(label) ?? null);

  const versionCell = cellText(ws.getRow(1).getCell(1).value);

  return {
    templateVersion: versionCell,
    companyName: get("Razón Social (1)"),
    companyRut: get("RUT"),
    companyLegalAddress: get("Domicilio Legal"),
    contacts: parseContactsBlock(ws),

    projectName: get("Nombre del Proyecto"),
    projectKind: get("Tipo de proyecto"),
    technology: get("Tipo de Tecnología"),
    netInjectionMw: getNum("Potencia neta solicitada de inyección [MW]"),
    netWithdrawalMw: getNum("Potencia neta solicitada de retiro [MW]"),
    powerFactor: getNum("Factor de potencia nominal"),
    inverterControlMode: get("Modo de control inversores"),
    generationComponentMw: cellNumber(valueAfterHeader(ws, "Componente generación")),
    storageComponentMw: cellNumber(valueAfterHeader(ws, "Componente de almacenamiento")),
    storageEnergyMwh: getNum("Energía [MWh]"),
    storageHours: getNum("Horas de almacenamiento [h]"),
    projectLocation: parseLocationBlock(ws, "Ubicación Geográfica del proyecto"),

    substationName: get("Nombre de la S/E o Línea de Transmisión"),
    connectionType: get("Tipo de Conexión"),
    voltageKv: getNum("Nivel de Tensión [kV]"),
    bay: get("Paño o N° de estructura(s)"),
    estimatedConstructionDate: extractIsoDate(map.get("Fecha estimada de Declaración en Construcción") ?? null),
    estimatedOperationDate: extractIsoDate(map.get("Fecha estimada de Entrada en Operación") ?? null),
    connectionLocation: parseLocationBlock(ws, "Ubicación Geográfica del punto de conexión"),
  };
}

export async function parseFormularioVerificacion(filePath: string): Promise<FormularioVerification> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  // Igual que la pestaña rica, el nombre exacto puede variar por plantilla —
  // "FORM. VERIFICACIÓN" es el nombre visto hasta ahora en SAC y FEH, pero se
  // permite cualquier pestaña cuyo nombre contenga "VERIFICA" por si una
  // variante futura lo escribe distinto.
  const ws = workbook.getWorksheet("FORM. VERIFICACIÓN") ?? workbook.worksheets.find((s) => /verifica/i.test(s.name));
  if (!ws) {
    return {
      projectName: null,
      companyName: null,
      requestType: null,
      requestDate: null,
      completenessScore: null,
      signedByName: null,
      signedByRole: null,
      signedByCompany: null,
    };
  }

  const projectRow = ws.getRow(8);
  const companyRow = ws.getRow(9);
  const scoreRow = ws.getRow(22);

  // Bloque de firma: 3 filas consecutivas (nombre / cargo / empresa) — se ancla
  // en la fila cuyo cargo es "Representante Legal", ya que es un texto distintivo.
  let roleRowNumber: number | null = null;
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (roleRowNumber === null && cellText(row.getCell(4).value) === "Representante Legal") {
      roleRowNumber = rowNumber;
    }
  });

  return {
    projectName: cellText(projectRow.getCell(3).value),
    companyName: cellText(companyRow.getCell(3).value),
    requestType: cellText(projectRow.getCell(8).value),
    requestDate: extractIsoDate(companyRow.getCell(8).value),
    completenessScore: cellNumber(scoreRow.getCell(7).value),
    signedByName: roleRowNumber ? cellText(ws.getRow(roleRowNumber - 1).getCell(4).value) : null,
    signedByRole: roleRowNumber ? cellText(ws.getRow(roleRowNumber).getCell(4).value) : null,
    signedByCompany: roleRowNumber ? cellText(ws.getRow(roleRowNumber + 1).getCell(4).value) : null,
  };
}

export function checkConsistency(
  formulario: FormularioData,
  verificacion: FormularioVerification,
): FormularioConsistencyIssue[] {
  const issues: FormularioConsistencyIssue[] = [];
  if (formulario.projectName !== verificacion.projectName) {
    issues.push({ field: "projectName", formularioValue: formulario.projectName, verificacionValue: verificacion.projectName });
  }
  if (formulario.companyName !== verificacion.companyName) {
    issues.push({ field: "companyName", formularioValue: formulario.companyName, verificacionValue: verificacion.companyName });
  }
  return issues;
}
