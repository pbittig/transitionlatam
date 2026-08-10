import { readFile } from "node:fs/promises";
import type { FormularioData, FormularioVerification } from "./types";
import { extractFormularioWithAi } from "./extractWithAi";

function toIsoDate(ddmmyyyy: string | null): string | null {
  if (!ddmmyyyy) return null;
  const match = ddmmyyyy.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

/**
 * Distingue las dos variantes reales de PDF que encontramos en Acceso Abierto
 * (ver docs/05-arquitectura-tecnica.md §5.10): el checklist de verificación
 * (texto lineal, se parsea con regex) y el formulario rico exportado a PDF
 * (mismo contenido que la plantilla Excel, pero con el orden de lectura
 * desordenado — requiere extracción asistida por IA). Detección por contenido,
 * no por nombre de archivo, porque ambos vienen con nombres similares.
 *
 * Hallazgo real (caso "BESS II San Andrés"): el "Formulario Proyecto Fehaciente"
 * viene como un solo PDF de 2 páginas — la 1ª es el formulario rico completo
 * (con correos reales), la 2ª es el checklist de verificación de esa misma
 * solicitud. El detector original solo miraba si el texto completo contenía
 * "completitud"/"¿Cumple?" y mandaba TODO el documento al parser de regex,
 * descartando los correos que sí estaban presentes unas líneas más arriba.
 * Por eso ahora exige además la AUSENCIA de señales de la sección rica — si
 * ambas conviven en el mismo texto, se prefiere la extracción con IA (ya
 * tolera el orden de lectura desordenado y los campos duplicados por columna).
 */
function hasRichFormSection(text: string): boolean {
  return /e-mail/i.test(text) || /Contacto de Representante Legal/i.test(text) || /Raz[oó]n Social/i.test(text);
}

function isVerificationChecklist(text: string): boolean {
  return /completitud/i.test(text) && /¿Cumple\?/i.test(text) && !hasRichFormSection(text);
}

function parseVerificationChecklist(text: string): FormularioVerification {
  const proyectoMatch = text.match(/Proyecto\s*\t\s*(.+?)\s*\t\s*(.+?)\s*\n/);
  const empresaMatch = text.match(/Empresa\s*\t\s*(.+?)\s*\t\s*(\d{2}-\d{2}-\d{4})\s*\n/);
  const signerName = text.match(/Nombre:\s*(.+)/)?.[1]?.trim() ?? null;
  const signerRole = text.match(/Cargo:\s*(.+)/)?.[1]?.trim() ?? null;
  const signerCompany = text.match(/Empresa:\s*(.+)/)?.[1]?.trim() ?? null;
  const completeness = text.match(/completitud\s+(\d+)\s*%/)?.[1] ?? null;

  return {
    projectName: proyectoMatch?.[1] ?? null,
    companyName: empresaMatch?.[1] ?? signerCompany,
    requestType: proyectoMatch?.[2] ?? null,
    requestDate: toIsoDate(empresaMatch?.[2] ?? null),
    completenessScore: completeness ? Number(completeness) / 100 : null,
    signedByName: signerName,
    signedByRole: signerRole,
    signedByCompany: signerCompany,
  };
}

export async function parseFormularioPdf(
  filePath: string,
): Promise<{ kind: "full"; data: FormularioData } | { kind: "verification_only"; data: FormularioVerification }> {
  const data = await readFile(filePath);
  // Import dinámico: pdf-parse (vía pdfjs-dist/@napi-rs/canvas) puede fallar a
  // cargar en el runtime serverless de Vercel (ver commit eebfcdf) — un import
  // estático arrastraría ese riesgo a TODA la ruta que importa este archivo
  // (ej. /admin/verificador, incluido el botón "Verificado", que no necesita
  // leer PDFs para nada). Aislado así, un fallo acá solo rompe el parseo de
  // este PDF puntual, no las demás acciones de la misma página.
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data });
  const { text } = await parser.getText();

  if (isVerificationChecklist(text)) {
    return { kind: "verification_only", data: parseVerificationChecklist(text) };
  }
  return { kind: "full", data: await extractFormularioWithAi(text) };
}
