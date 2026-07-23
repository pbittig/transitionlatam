import AdmZip from "adm-zip";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import type { FormularioResult } from "./types";
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
    return { kind: "full", data: await parseFormularioExcel(filePath) };
  }
  if (ext === ".pdf") {
    return parseFormularioPdf(filePath);
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
