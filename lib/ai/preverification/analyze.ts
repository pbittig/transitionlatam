import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import type { FormularioResult } from "@/lib/ingestion/sources/energia-abierta/detalle-formulario/types";
import type { TechnologyCombo } from "@/app/(public)/admin/technologyCombos";
import { completePreverificationReview } from "./reviewProvider";

export interface DeepDocumentAssessment {
  technologyCombo: TechnologyCombo | null;
  technologyConfidence: "high" | "medium" | "low" | null;
  technologyReason: string;
  capacityMw: number | null;
  capacityMwConfidence: "high" | "medium" | "low" | null;
  storageHours: number | null;
  storageHoursConfidence: "high" | "medium" | "low" | null;
  capacityMwh: number | null;
  capacityMwhConfidence: "high" | "medium" | "low" | null;
  companyRut: string | null;
  companyRutConfidence: "high" | "medium" | "low" | null;
  companyLegalAddress: string | null;
  companyLegalAddressConfidence: "high" | "medium" | "low" | null;
  evidence: string;
}

const ASSESSMENT_PROMPT = `Eres un revisor conservador de proyectos eléctricos chilenos.
Recibirás la extracción estructurada del Formulario y, opcionalmente, texto del
Informe de Autorización de Conexión (preliminar, definitivo, o de proyecto
Fehaciente).

Determina tecnología, potencia BESS, horas, energía BESS, y RUT/dirección legal
de la empresa titular. El Formulario es la fuente principal para todo. El
informe secundario solo puede resolver horas BESS, la duda de si el proyecto
combina generación y almacenamiento, o completar RUT/dirección legal cuando el
Formulario no los trae — el informe de autorización suele identificar
formalmente al titular con esos datos.

Reglas:
- No inventes. Si el dato no está explícito o hay contradicción, devuelve null.
- "high" exige evidencia explícita y consistente en el documento.
- Una energía MWh calculada como MW × horas nunca es high; usa medium y explica.
- technologyCombo debe ser uno de solar, wind, hydro, bess, solar_bess,
  wind_bess, hydro_bess, solar_wind, hybrid_other, o null.
- capacityMw representa la potencia titular del proyecto BESS: para BESS puro,
  la potencia de almacenamiento; para híbrido, la potencia informada como
  capacidad general/neta, sin inventar una suma.
- companyRut debe venir en formato chileno con guión (ej. "76.492.150-K"), tal
  como aparece en el documento — no inventes el dígito verificador.
- companyLegalAddress es la dirección legal/domicilio de la empresa titular, no
  del punto de conexión ni del proyecto.
- Resume evidence en una frase breve, sin copiar pasajes largos.

Responde solo JSON con:
{"technologyCombo":string|null,"technologyConfidence":"high"|"medium"|"low"|null,
"technologyReason":string,"capacityMw":number|null,
"capacityMwConfidence":"high"|"medium"|"low"|null,"storageHours":number|null,
"storageHoursConfidence":"high"|"medium"|"low"|null,"capacityMwh":number|null,
"capacityMwhConfidence":"high"|"medium"|"low"|null,"companyRut":string|null,
"companyRutConfidence":"high"|"medium"|"low"|null,"companyLegalAddress":string|null,
"companyLegalAddressConfidence":"high"|"medium"|"low"|null,"evidence":string}`;

export async function extractPdfText(filePath: string): Promise<string> {
  if (extname(filePath).toLowerCase() !== ".pdf") return "";
  // Import dinámico — ver mismo comentario en parsePdf.ts (commit eebfcdf):
  // aísla el riesgo de que pdf-parse falle a cargar en producción a solo esta
  // función, en vez de tumbar toda la ruta que la importa.
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: await readFile(filePath) });
  const { text } = await parser.getText();
  return text.slice(0, 60_000);
}

export async function assessProjectDocuments(
  formulario: FormularioResult | null,
  preliminaryReportText: string | null,
): Promise<DeepDocumentAssessment> {
  if (!formulario && !preliminaryReportText) {
    return {
      technologyCombo: null, technologyConfidence: null, technologyReason: "No hay documentos analizables.",
      capacityMw: null, capacityMwConfidence: null, storageHours: null, storageHoursConfidence: null,
      capacityMwh: null, capacityMwhConfidence: null,
      companyRut: null, companyRutConfidence: null, companyLegalAddress: null, companyLegalAddressConfidence: null,
      evidence: "Sin evidencia documental.",
    };
  }
  const prompt = JSON.stringify({
    formulario,
    informePreliminar: preliminaryReportText || null,
  });
  const raw = await completePreverificationReview(ASSESSMENT_PROMPT, prompt, 2500);
  return JSON.parse(raw) as DeepDocumentAssessment;
}
