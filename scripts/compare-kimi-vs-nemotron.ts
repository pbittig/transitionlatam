// Comparación objetiva Nemotron vs Kimi (Moonshot) sobre los mismos 5 PDFs
// reales que pasan por extracción con IA (los otros 2 archivos de la prueba
// van por Excel determinístico, no aplica). Corre el mismo SYSTEM_PROMPT de
// extractWithAi.ts contra ambos proveedores y muestra los campos que fallaron
// en la corrida anterior de Nemotron (RUT, nombre del proyecto, generación).
import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFParse } from "pdf-parse";
import { completeWithNemotron } from "../lib/ai/provider/nvidia";
import { completeWithKimi } from "../lib/ai/provider/kimi";
import { SYSTEM_PROMPT } from "../lib/ingestion/sources/energia-abierta/detalle-formulario/extractWithAi";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const FILES = [
  join(__dirname, "..", "Entrenamiento", "Form tipo 1 en pdf.pdf"),
  join(__dirname, "..", "Entrenamiento", "Form tipo 2 en pdf.pdf"),
  join(__dirname, "..", "Entrenamiento", "Prueba final", "Formulario_SUCTD_-_PE_Degan.pdf"),
  join(__dirname, "..", "Entrenamiento", "Prueba final", "1._2504-FORM-SUCTD-BESS_PECLI_21-05-2026_VF.pdf"),
  join(__dirname, "..", "Entrenamiento", "Prueba final", "Formulario_SAC_-_Tebe_firmado.pdf"),
];

function pick(parsed: Record<string, unknown>) {
  return {
    companyRut: parsed.companyRut,
    projectName: parsed.projectName,
    generationComponentMw: parsed.generationComponentMw,
    storageComponentMw: parsed.storageComponentMw,
    storageEnergyMwh: parsed.storageEnergyMwh,
    storageHours: parsed.storageHours,
    contacts: parsed.contacts,
  };
}

async function run(label: string, fn: () => Promise<string>) {
  const start = Date.now();
  try {
    const raw = await fn();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    console.log(`\n--- ${label} (${Date.now() - start}ms) ---`);
    console.log(JSON.stringify(pick(parsed), null, 2));
  } catch (err) {
    console.log(`\n--- ${label} (${Date.now() - start}ms) — ERROR ---`);
    console.log(err instanceof Error ? err.message : err);
  }
}

async function main() {
  for (const filePath of FILES) {
    const fileName = filePath.split(/[/\\]/).pop()!;
    console.log(`\n${"=".repeat(70)}\n${fileName}\n${"=".repeat(70)}`);

    const data = await readFile(filePath);
    const parser = new PDFParse({ data });
    const { text } = await parser.getText();

    await run("Nemotron", () => completeWithNemotron(SYSTEM_PROMPT, text, { jsonMode: true, maxTokens: 7000 }));
    await run("Kimi", () => completeWithKimi(SYSTEM_PROMPT, text, { jsonMode: true, maxTokens: 7000 }));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
