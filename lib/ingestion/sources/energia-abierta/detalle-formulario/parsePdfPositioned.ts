import type { FormularioContact, FormularioData, FormularioLocation } from "./types";

// Extracción determinística del Formulario PDF usando pdf-inspector (coordenadas
// X/Y reales por ítem de texto) en vez de IA. Reemplaza la necesidad de que un
// modelo de lenguaje adivine a qué campo pertenece cada dato en un PDF cuyo
// orden de lectura interno está desordenado (ver extractWithAi.ts) — con
// coordenadas reales no hay nada que adivinar: la etiqueta y su valor están a
// la misma altura (Y) en columnas separadas (X), igual que en el PDF visual.
//
// Probado en 2026-08-10 contra 20 Formularios PDF reales + los 2 casos donde
// la IA se trabó tratando de asociar coordinador de proyecto (texto desordenado
// de pdf-parse): con coordenadas, la etiqueta queda pegada a su valor real en
// 20/20 casos para RUT y e-mail (vs 2/20 con pdf-parse). Cubre las dos familias
// de plantilla reales vistas (versión vieja "07-06-21"/"25-05-21", un solo
// campo "Potencia Nominal [MW]" y etiquetas de coordinador repetidas sin
// numerar; plantilla nueva "2504-FORM-SAC-V1"/"FEH-V1", con "Componente
// generación"/"Componente de almacenamiento" separados y etiquetas de
// coordinador numeradas "primer"/"segundo"/... hasta seis en un caso real).
//
// Si el documento no calza con ninguno de los patrones esperados (ej. una
// plantilla nueva no vista, o un PDF escaneado sin texto), se devuelve null
// y el llamador (parsePdf.ts) cae de vuelta a extractFormularioWithAi — nunca
// se fuerza un resultado de baja confianza como si fuera bueno.

interface PositionedItem {
  text: string;
  x: number;
  y: number;
  page: number;
  fontSize: number;
}

interface FieldOccurrence {
  key: FieldKey;
  value: string;
}

type FieldKey =
  | "razonSocial"
  | "rut"
  | "domicilioLegal"
  | "contactoRepresentanteLegalHeader"
  | "coordinadoresHeader"
  | "nombreContacto"
  | "email"
  | "telefono"
  | "antecedentesProyectoHeader"
  | "nombreProyecto"
  | "tipoProyecto"
  | "tipoTecnologia"
  | "potenciaNominal"
  | "potenciaInyeccion"
  | "potenciaRetiro"
  | "factorPotencia"
  | "modoControlInversores"
  | "componenteGeneracionHeader"
  | "componenteAlmacenamientoHeader"
  | "potenciaComponente"
  | "energiaComponente"
  | "horasAlmacenamiento"
  | "ubicacionProyectoHeader"
  | "ubicacionConexionHeader"
  | "huso"
  | "este"
  | "norte"
  | "comuna"
  | "region"
  | "nombreSubestacion"
  | "tipoConexion"
  | "nivelTension"
  | "pano"
  | "fechaConstruccion"
  | "fechaInterconexion"
  | "verificacionHeader";

// Orden importa: patrones más específicos primero para que no los capture uno genérico.
const LABEL_PATTERNS: Array<{ key: FieldKey; pattern: RegExp }> = [
  { key: "razonSocial", pattern: /^Raz[oó]n Social\b/i },
  { key: "rut", pattern: /^RUT$/i },
  { key: "domicilioLegal", pattern: /^Domicilio Legal$/i },
  { key: "contactoRepresentanteLegalHeader", pattern: /^Contacto de Representante Legal$/i },
  { key: "coordinadoresHeader", pattern: /^Coordinadores? de proyectos?$/i },
  // Cualquier "Nombre..." dentro del bloque de contactos abre un contacto nuevo
  // (el primero = representante legal, los siguientes = coordinadores) — no hace
  // falta distinguir "del Representante Legal" de "primer coordinador de
  // proyecto" por texto, el ORDEN de aparición ya lo determina (ver parseContactsBlock
  // en parseXlsx.ts, mismo criterio). Se excluye "Nombre del Proyecto" explícitamente
  // porque usa la misma palabra inicial pero vive fuera de este bloque.
  { key: "nombreContacto", pattern: /^Nombre (?!del Proyecto\b).*(?:Representante Legal|coordinador)/i },
  { key: "email", pattern: /^e-?mail/i },
  { key: "telefono", pattern: /^Tel[eé]fono/i },
  { key: "antecedentesProyectoHeader", pattern: /^Antecedentes del Proyecto$/i },
  { key: "nombreProyecto", pattern: /^Nombre del Proyecto$/i },
  { key: "tipoProyecto", pattern: /^Tipo (de )?[Pp]royecto\b/i },
  { key: "tipoTecnologia", pattern: /^(Tipo de Tecnolog[ií]a|En caso de proyectos de generaci[oó]n, tipo de tecnolog[ií]a)/i },
  { key: "potenciaNominal", pattern: /^Potencia Nominal \[MW\]$/i },
  { key: "potenciaInyeccion", pattern: /^Potencia neta solicitada de inyecci[oó]n \[MW\]$/i },
  { key: "potenciaRetiro", pattern: /^Potencia neta solicitada de retiro \[MW\]$/i },
  { key: "factorPotencia", pattern: /^Factor de [Pp]otencia( nominal)?$/i },
  { key: "modoControlInversores", pattern: /^Modo de control inversores$/i },
  { key: "componenteGeneracionHeader", pattern: /^Componente generaci[oó]n$/i },
  { key: "componenteAlmacenamientoHeader", pattern: /^Componente de almacenamiento$/i },
  { key: "potenciaComponente", pattern: /^Potencia \[MW\]$/i },
  { key: "energiaComponente", pattern: /^Energ[ií]a \[MWh\]$/i },
  { key: "horasAlmacenamiento", pattern: /^Horas de almacenamiento \[h\]$/i },
  { key: "ubicacionProyectoHeader", pattern: /^Ubicaci[oó]n Geogr[aá]fica del [Pp]royecto$/i },
  { key: "ubicacionConexionHeader", pattern: /^Ubicaci[oó]n Geogr[aá]fica del punto de conexi[oó]n$/i },
  { key: "huso", pattern: /^Huso$/i },
  { key: "este", pattern: /^Este$/i },
  { key: "norte", pattern: /^Norte$/i },
  { key: "comuna", pattern: /^Comuna$/i },
  { key: "region", pattern: /^Regi[oó]n$/i },
  { key: "nombreSubestacion", pattern: /^Nombre de la S\/E/i },
  { key: "tipoConexion", pattern: /^(Tipo de Conexi[oó]n|Car[aá]cter de conexi[oó]n)/i },
  { key: "nivelTension", pattern: /^Nivel de Tensi[oó]n \[kV\]$/i },
  { key: "pano", pattern: /^Pa[ñn]o o N/i },
  { key: "fechaConstruccion", pattern: /^Fecha estimada de Declaraci[oó]n en Construcci[oó]n$/i },
  { key: "fechaInterconexion", pattern: /^Fecha estimada de (Interconexi[oó]n|Entrada en Operaci[oó]n)$/i },
  { key: "verificacionHeader", pattern: /^Formulario de verificaci[oó]n/i },
];

const FOOTNOTE_MARKER = /^\(\d+\)$/;
const RUT_PATTERN = /\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]/;

function matchLabel(text: string): FieldKey | null {
  const trimmed = text.trim();
  for (const { key, pattern } of LABEL_PATTERNS) {
    if (pattern.test(trimmed)) return key;
  }
  return null;
}

/** Agrupa ítems en filas visuales (misma página, Y dentro de una tolerancia chica) ordenadas de arriba hacia abajo, izquierda a derecha. */
function groupIntoRows(items: PositionedItem[]): PositionedItem[][] {
  const clean = items.filter((it) => it.fontSize > 0 && !FOOTNOTE_MARKER.test(it.text.trim()) && it.text.trim().length > 0);
  const sorted = [...clean].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);

  const rows: PositionedItem[][] = [];
  const Y_TOLERANCE = 3;
  for (const item of sorted) {
    const last = rows[rows.length - 1];
    if (last && last[0].page === item.page && Math.abs(last[0].y - item.y) <= Y_TOLERANCE) {
      last.push(item);
      last.sort((a, b) => a.x - b.x);
    } else {
      rows.push([item]);
    }
  }
  return rows;
}

/**
 * Recorre las filas y separa ocurrencias de campo — una fila puede traer
 * varios pares etiqueta:valor pegados uno al lado del otro (hallazgo real,
 * plantilla vieja: "Tipo Proyecto ... Hibrido | Potencia Nominal [MW] ... 20"
 * en la misma línea visual). Cualquier ítem que matchee una etiqueta conocida
 * abre un campo nuevo; los ítems siguientes (hasta la próxima etiqueta u otra
 * fila) son su valor.
 */
function extractFieldOccurrences(rows: PositionedItem[][]): FieldOccurrence[] {
  const occurrences: FieldOccurrence[] = [];
  for (const row of rows) {
    let current: { key: FieldKey; valueParts: string[] } | null = null;
    for (const item of row) {
      const key = matchLabel(item.text);
      if (key) {
        if (current) occurrences.push({ key: current.key, value: current.valueParts.join(" ").trim() });
        current = { key, valueParts: [] };
      } else if (current) {
        current.valueParts.push(item.text.trim());
      }
    }
    if (current) occurrences.push({ key: current.key, value: current.valueParts.join(" ").trim() });
  }
  return occurrences;
}

function firstValue(occurrences: FieldOccurrence[], key: FieldKey): string | null {
  return occurrences.find((o) => o.key === key && o.value)?.value ?? null;
}

function parseNumber(raw: string | null): number | null {
  if (!raw) return null;
  let s = raw.replace(/\s*(MWh|MW|MVA|kWh|kW|kV)\s*$/i, "").trim();
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

function extractContacts(occurrences: FieldOccurrence[]): FormularioContact[] {
  const startIdx = occurrences.findIndex((o) => o.key === "contactoRepresentanteLegalHeader" || o.key === "nombreContacto");
  if (startIdx === -1) return [];
  const endIdx = occurrences.findIndex((o, i) => i > startIdx && o.key === "antecedentesProyectoHeader");
  const block = occurrences.slice(startIdx, endIdx === -1 ? occurrences.length : endIdx);

  const roles: FormularioContact["role"][] = ["legal_representative", "project_coordinator_1", "project_coordinator_2"];
  const drafts: Array<{ name: string | null; email: string | null; phone: string | null }> = [];
  let current: { name: string | null; email: string | null; phone: string | null } | null = null;

  for (const o of block) {
    if (o.key === "nombreContacto") {
      current = { name: o.value || null, email: null, phone: null };
      drafts.push(current);
    } else if (o.key === "email" && current) {
      current.email = o.value || null;
    } else if (o.key === "telefono" && current) {
      current.phone = o.value || null;
    }
  }

  const contacts: FormularioContact[] = [];
  drafts.slice(0, 3).forEach((d, i) => {
    if (d.name) contacts.push({ role: roles[i], name: d.name, email: d.email, phone: d.phone });
  });
  return contacts;
}

/** "Componente generación"/"Componente de almacenamiento" — sección determina a cuál de las dos pertenece cada "Potencia [MW]" siguiente (mismo criterio que valueAfterHeader en parseXlsx.ts). */
function extractStorageComponents(occurrences: FieldOccurrence[]): { generationMw: number | null; storageMw: number | null; storageMwh: number | null; storageHours: number | null } {
  let section: "generation" | "storage" | null = null;
  let generationMw: number | null = null;
  let storageMw: number | null = null;
  let storageMwh: number | null = null;
  let storageHours: number | null = null;

  for (const o of occurrences) {
    if (o.key === "componenteGeneracionHeader") section = "generation";
    else if (o.key === "componenteAlmacenamientoHeader") section = "storage";
    else if (o.key === "potenciaComponente" && section === "generation" && generationMw === null) generationMw = parseNumber(o.value);
    else if (o.key === "potenciaComponente" && section === "storage" && storageMw === null) storageMw = parseNumber(o.value);
    else if (o.key === "energiaComponente" && section === "storage") storageMwh = parseNumber(o.value);
    else if (o.key === "horasAlmacenamiento" && section === "storage") storageHours = parseNumber(o.value);
  }
  return { generationMw, storageMw, storageMwh, storageHours };
}

/** Huso/Este/Norte + Comuna/Región después de un encabezado de ubicación — misma fila o filas inmediatas siguientes. */
function extractLocation(occurrences: FieldOccurrence[], headerKey: FieldKey, stopKey: FieldKey): FormularioLocation {
  const empty: FormularioLocation = { utmZone: null, utmEast: null, utmNorth: null, comuna: null, region: null };
  const startIdx = occurrences.findIndex((o) => o.key === headerKey);
  if (startIdx === -1) return empty;
  const endIdx = occurrences.findIndex((o, i) => i > startIdx && o.key === stopKey);
  const block = occurrences.slice(startIdx, endIdx === -1 ? occurrences.length : endIdx);

  return {
    utmZone: firstValue(block, "huso"),
    utmEast: parseNumber(firstValue(block, "este")),
    utmNorth: parseNumber(firstValue(block, "norte")),
    comuna: firstValue(block, "comuna"),
    region: firstValue(block, "region"),
  };
}

function normalizeMonthYear(raw: string | null): string | null {
  // Fechas en este formulario vienen como "mar-25" (mes-año corto) — se deja tal
  // cual (string), no se fuerza a fecha completa: no hay día real que inventar.
  return raw;
}

/**
 * Punto de entrada — items ya vienen de extractTextWithPositions sobre TODAS
 * las páginas del PDF (no solo la primera: una plantilla con domicilio largo
 * puede correr el resto de los campos a la página 2). Se corta en el primer
 * "Formulario de verificación..." — todo lo posterior es el checklist de
 * firma/entrega, no datos del formulario rico (ver hasRichFormSection en
 * parsePdf.ts, mismo límite).
 */
export function parseFormularioPdfDeterministic(items: PositionedItem[]): FormularioData | null {
  const rows = groupIntoRows(items);
  const allOccurrences = extractFieldOccurrences(rows);
  const stopIdx = allOccurrences.findIndex((o) => o.key === "verificacionHeader");
  const occurrences = stopIdx === -1 ? allOccurrences : allOccurrences.slice(0, stopIdx);

  const companyName = firstValue(occurrences, "razonSocial");
  const rutRaw = firstValue(occurrences, "rut");
  const companyRut = rutRaw && RUT_PATTERN.test(rutRaw) ? rutRaw : null;
  const contacts = extractContacts(occurrences);

  // Señal mínima de confianza — sin razón social + RUT válido, o sin ningún
  // contacto, es mejor admitir que no reconocimos la plantilla y dejar que
  // extractFormularioWithAi lo intente, no forzar un resultado a medias.
  if (!companyName || !companyRut || contacts.length === 0) return null;

  const storage = extractStorageComponents(occurrences);
  const potenciaNominal = parseNumber(firstValue(occurrences, "potenciaNominal"));
  const technology = firstValue(occurrences, "tipoTecnologia");

  return {
    templateVersion: null,
    companyName,
    companyRut,
    companyLegalAddress: firstValue(occurrences, "domicilioLegal"),
    contacts,

    projectName: firstValue(occurrences, "nombreProyecto"),
    projectKind: firstValue(occurrences, "tipoProyecto"),
    technology,
    // Plantilla nueva trae inyección/retiro separados; la vieja solo "Potencia
    // Nominal [MW]" general — se usa como inyección por ser el campo más
    // cercano en significado cuando no hay separación real.
    netInjectionMw: parseNumber(firstValue(occurrences, "potenciaInyeccion")) ?? potenciaNominal,
    netWithdrawalMw: parseNumber(firstValue(occurrences, "potenciaRetiro")),
    powerFactor: parseNumber(firstValue(occurrences, "factorPotencia")),
    inverterControlMode: firstValue(occurrences, "modoControlInversores"),
    generationComponentMw: storage.generationMw,
    storageComponentMw: storage.storageMw,
    storageEnergyMwh: storage.storageMwh,
    storageHours: storage.storageHours,
    projectLocation: extractLocation(occurrences, "ubicacionProyectoHeader", "ubicacionConexionHeader"),

    substationName: firstValue(occurrences, "nombreSubestacion"),
    connectionType: firstValue(occurrences, "tipoConexion"),
    voltageKv: parseNumber(firstValue(occurrences, "nivelTension")),
    bay: firstValue(occurrences, "pano"),
    estimatedConstructionDate: normalizeMonthYear(firstValue(occurrences, "fechaConstruccion")),
    estimatedOperationDate: normalizeMonthYear(firstValue(occurrences, "fechaInterconexion")),
    connectionLocation: extractLocation(occurrences, "ubicacionConexionHeader", "verificacionHeader"),
  };
}
