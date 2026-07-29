// scripts/screen-verification-queue.ts
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runScreeningQueue } from "../lib/ai/screening/runScreeningQueue";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const BATCH_SIZE = Number(process.argv[2] ?? "50");

async function main() {
  console.log(`Tamizando hasta ${BATCH_SIZE} proyectos pendientes...`);
  const summary = await runScreeningQueue(undefined, BATCH_SIZE);
  console.log(`Proyectos pendientes de tamizar en esta corrida: ${summary.pending}.`);
  console.log("\n--- Resumen ---");
  console.log("Tamizados:", summary.screened);
  console.log("Sospechosos:", summary.sospechosos);
  console.log("Con candidato SEIA sugerido:", summary.conPick);
  console.log("Errores:", summary.errors);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
