// Simulación de extracción de Formulario contra archivos de entrenamiento reales
// (carpeta Entrenamiento/) — prueba de punta a punta de los 3 fixes: soporte de
// .zip, detección de pestaña de Excel agnóstica a plantilla, y el prompt de IA
// ampliado para los dos layouts de PDF conocidos. Imprime cada archivo con la
// plantilla estándar pedida (razón social, RUT, domicilio, representante legal,
// coordinadores, proyecto, componente generación/almacenamiento, comuna/región).
import { config } from "dotenv";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFormulario } from "../lib/ingestion/sources/energia-abierta/detalle-formulario";
import type { FormularioContact, FormularioResult } from "../lib/ingestion/sources/energia-abierta/detalle-formulario/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const TRAINING_DIR = join(__dirname, "..", "Entrenamiento");

function contact(contacts: FormularioContact[], role: FormularioContact["role"]): FormularioContact | null {
  return contacts.find((c) => c.role === role) ?? null;
}

function printField(label: string, value: string | number | null | undefined) {
  console.log(`  ${label}: ${value ?? "—"}`);
}

function printResult(fileName: string, result: FormularioResult) {
  console.log(`\n${"=".repeat(70)}\n${fileName} — kind: ${result.kind}\n${"=".repeat(70)}`);

  if (result.kind === "verification_only") {
    const v = result.data;
    console.log("(Solo checklist de verificación — sin datos ricos de contacto/proyecto)");
    printField("Proyecto", v.projectName);
    printField("Empresa", v.companyName);
    printField("Firmante", v.signedByName);
    printField("Cargo", v.signedByRole);
    return;
  }

  const d = result.data;
  const legal = contact(d.contacts, "legal_representative");
  const coord1 = contact(d.contacts, "project_coordinator_1");
  const coord2 = contact(d.contacts, "project_coordinator_2");

  console.log("Empresa solicitante:");
  printField("Razón Social", d.companyName);
  printField("RUT", d.companyRut);
  printField("Domicilio Legal", d.companyLegalAddress);

  console.log("\nContacto de Representante Legal:");
  printField("Nombre", legal?.name);
  printField("e-mail", legal?.email);
  printField("Teléfono", legal?.phone);

  console.log("\nCoordinadores de proyecto:");
  if (!coord1 && !coord2) {
    console.log("  (ninguno)");
  } else {
    if (coord1) {
      printField("Nombre coordinador 1", coord1.name);
      printField("e-mail coordinador 1", coord1.email);
      printField("Teléfono coordinador 1", coord1.phone);
    }
    if (coord2) {
      printField("Nombre coordinador 2", coord2.name);
      printField("e-mail coordinador 2", coord2.email);
      printField("Teléfono coordinador 2", coord2.phone);
    }
  }

  console.log("\nProyecto:");
  printField("Nombre del Proyecto", d.projectName);

  console.log("\nComponente generación:");
  printField("Potencia [MW]", d.generationComponentMw);

  console.log("\nComponente de almacenamiento:");
  printField("Potencia [MW]", d.storageComponentMw);
  printField("Energía [MWh]", d.storageEnergyMwh);
  printField("Horas de almacenamiento [h]", d.storageHours);

  console.log("\nUbicación del proyecto:");
  printField("Comuna", d.projectLocation.comuna);
  printField("Región", d.projectLocation.region);
}

async function main() {
  const requested = process.argv.slice(2);
  const files =
    requested.length > 0
      ? requested
      : readdirSync(TRAINING_DIR)
          .filter((f) => /\.(pdf|xlsx|xls|zip)$/i.test(f))
          .map((f) => join(TRAINING_DIR, f));

  let ok = 0;
  let failed = 0;
  for (const filePath of files) {
    const fileName = filePath.split(/[/\\]/).pop()!;
    try {
      const result = await parseFormulario(filePath);
      printResult(fileName, result);
      ok++;
    } catch (err) {
      console.log(`\n${"=".repeat(70)}\n${fileName} — ERROR\n${"=".repeat(70)}`);
      console.log(`  ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\n\n--- Resumen ---`);
  console.log(`Procesados sin error: ${ok}`);
  console.log(`Con error: ${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
