import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFParse } from "pdf-parse";
import { completeWithNemotron } from "../lib/ai/provider/nvidia";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const MODELS = ["nvidia/llama-3.1-nemotron-nano-8b-v1", "nvidia/llama-3.3-nemotron-super-49b-v1.5"];

const SYSTEM_PROMPT = `Extrae de este texto (desordenado, extraído de un PDF) los 3 contactos del formulario SAC:
Representante Legal, Coordinador 1 y Coordinador 2 — cada uno con nombre, correo y teléfono, emparejados
correctamente aunque aparezcan separados en el texto. Responde solo JSON: {"contacts": [{"role":"...", "name":"...", "email":"...", "phone":"..."}]}`;

async function main() {
  const filePath = join(__dirname, "..", "dataset", "ejemplo_pdf2.pdf");
  const data = await readFile(filePath);
  const parser = new PDFParse({ data });
  const { text } = await parser.getText();

  for (const model of MODELS) {
    const start = Date.now();
    try {
      const result = await completeWithNemotron(SYSTEM_PROMPT, text, { model, jsonMode: true, maxTokens: 2000 });
      console.log(`\n=== ${model} (${Date.now() - start}ms) ===`);
      console.log(result);
    } catch (err) {
      console.log(`\n=== ${model} (${Date.now() - start}ms) — ERROR ===`);
      console.log(err instanceof Error ? err.message : err);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
