import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFParse } from "pdf-parse";
import { extractFormularioWithAi } from "../lib/ingestion/sources/energia-abierta/detalle-formulario/extractWithAi";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

async function main() {
  const filePath = process.argv[2] ?? join(__dirname, "..", "dataset", "ejemplo_pdf2.pdf");
  const data = await readFile(filePath);
  const parser = new PDFParse({ data });
  const { text } = await parser.getText();

  const result = await extractFormularioWithAi(text);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
