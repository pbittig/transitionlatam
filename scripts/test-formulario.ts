import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkConsistency,
  parseFormulario,
  parseFormularioVerificacion,
} from "../lib/ingestion/sources/energia-abierta/detalle-formulario";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const filePath = process.argv[2] ?? join(__dirname, "..", "dataset", "extract_examp.xlsx");
  const result = await parseFormulario(filePath);

  if (result.kind === "verification_only") {
    console.log("=== PDF: solo checklist de verificación (sin teléfono/correo) ===");
    console.log(JSON.stringify(result.data, null, 2));
    return;
  }

  console.log("=== Contactos extraídos ===");
  for (const c of result.data.contacts) {
    console.log(`- [${c.role}] ${c.name} | ${c.email} | ${c.phone}`);
  }

  console.log("\n=== Datos del proyecto (Formulario) ===");
  console.log(JSON.stringify(result.data, null, 2));

  const verificacion = await parseFormularioVerificacion(filePath);
  console.log("\n=== Verificación ===");
  console.log(JSON.stringify(verificacion, null, 2));

  const issues = checkConsistency(result.data, verificacion);
  console.log("\n=== Consistencia Formulario vs Verificación ===");
  console.log(issues.length === 0 ? "Sin inconsistencias." : issues);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
