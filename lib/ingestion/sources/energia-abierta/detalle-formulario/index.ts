import AdmZip from "adm-zip";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import type { FormularioData, FormularioResult } from "./types";
import { parseFormularioExcel } from "./parseXlsx";
import { parseFormularioPdf } from "./parsePdf";

export type {
  FormularioContact,
  FormularioData,
  FormularioResult,
  FormularioVerification,
} from "./types";
export { parseFormularioExcel, parseFormularioVerificacion, checkConsistency } from "./parseXlsx";
export { parseFormularioPdf } from "./parsePdf";

/**
 * Dentro de un .zip (hallazgo real: "Formulario-SAC-Proyecto-CRCA_Tilomonte.zip"
 * trae el PDF firmado Y el .xlsx original) se prioriza el Excel — la extracción
 * por celda es determinística, mientras que el PDF pasa por IA con orden de
 * lectura desordenado. Si no hay Excel, se usa el mejor PDF. Un .zip puede venir
 * anidado dentro de otro .zip — se seleccient igual (recursión en parseFormulario).
 */
function pickBestZipEntry(zip: AdmZip): AdmZip.IZipEntry | null {
  const entries = zip.getEntries().filter((e) => !e.isDirectory && !e.entryName.startsWith("__MACOSX/"));
  const byExt = (ext: string) => entries.find((e) => extname(e.entryName).toLowerCase() === ext);
  return byExt(".xlsx") ?? byExt(".xls") ?? byExt(".pdf") ?? byExt(".zip") ?? null;
}

const GENERATION_TECH_KEYWORDS = /solar|f[oó]tovoltaic|e[oó]lic|hidr[aá]ulic|hidro(?!geno)|t[eé]rmic|geot[eé]rmic/i;
const STORAGE_TECH_KEYWORDS = /bater[ií]a|bess|almacenamiento/i;

/**
 * Cuando "Tipo de Tecnología" indica almacenamiento puro (baterías/BESS, sin
 * ningún componente de generación como solar/eólica/hidro), se fuerza
 * generationComponentMw a null aunque el documento traiga un valor ahí —
 * criterio confirmado con el usuario: el rol de este campo es reflejar la
 * distinción real del proyecto, no lo que alguien completó por error en el
 * formulario original (hallazgo real: "BESS Espiga De Oro", tecnología
 * "Baterías" pero con 2.99 MW en el campo de generación). Aplica a ambas
 * rutas de extracción (Excel determinística y PDF vía IA) porque ambas
 * pueden heredar el mismo error de quien llenó el documento original.
 *
 * "Tipo de Proyecto" da una señal más explícita cuando menciona CRCA (Central
 * Renovable con Capacidad de Almacenamiento) — criterio confirmado con el
 * usuario: "Almacenamiento Para CRCA" es una solicitud que en sí misma es
 * solo almacenamiento (aporta la pieza de storage a un esquema CRCA más
 * amplio, hallazgo real "BESS Espiga De Oro"), mientras que "CRCA" a secas
 * (sin ese calificador) implica que ESTA solicitud trae generación renovable
 * + almacenamiento juntos — es híbrida, nunca se suprime generación aunque
 * "Tipo de Tecnología" solo mencione baterías.
 */
function isPureStorageProject(technology: string | null, projectKind: string | null): boolean {
  if (projectKind) {
    if (/almacenamiento\s+para\s+crca/i.test(projectKind)) return true;
    if (/\bcrca\b/i.test(projectKind)) return false;
  }
  if (!technology) return false;
  return STORAGE_TECH_KEYWORDS.test(technology) && !GENERATION_TECH_KEYWORDS.test(technology);
}

function applyGenerationStorageConsistencyRule(data: FormularioData): FormularioData {
  if (isPureStorageProject(data.technology, data.projectKind) && data.generationComponentMw !== null) {
    return { ...data, generationComponentMw: null };
  }
  return data;
}

/**
 * El documento "Formulario" descargado puede venir como Excel (plantilla fija
 * rica), PDF, o un .zip que contiene alguno de los dos (o, más raro, otro .zip
 * adentro). Dentro de PDF hay dos variantes reales distintas (ver parsePdf.ts):
 * un checklist de verificación simple, o el formulario rico con el orden de
 * lectura desordenado (requiere IA). El resultado siempre indica explícitamente
 * cuál se obtuvo — nunca tratar "verification_only" como si fuera la extracción
 * completa. Ver docs/05-arquitectura-tecnica.md §5.10.
 */
export async function parseFormulario(filePath: string): Promise<FormularioResult> {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".xlsx" || ext === ".xls") {
    return { kind: "full", data: applyGenerationStorageConsistencyRule(await parseFormularioExcel(filePath)) };
  }
  if (ext === ".pdf") {
    const result = await parseFormularioPdf(filePath);
    return result.kind === "full" ? { kind: "full", data: applyGenerationStorageConsistencyRule(result.data) } : result;
  }
  if (ext === ".zip") {
    const zip = new AdmZip(filePath);
    const entry = pickBestZipEntry(zip);
    if (!entry) throw new Error(`El .zip no contiene ningún .xlsx/.xls/.pdf/.zip reconocible (${filePath})`);

    const tempDir = await mkdtemp(join(tmpdir(), "formulario-zip-"));
    const entryPath = join(tempDir, entry.entryName.replace(/[/\\]/g, "_"));
    try {
      zip.extractEntryTo(entry, tempDir, false, true, false, entry.entryName.replace(/[/\\]/g, "_"));
      return await parseFormulario(entryPath);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
  throw new Error(`Formato de Formulario no soportado: '${ext}' (${filePath})`);
}
