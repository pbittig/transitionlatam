import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyTechnologyByName } from "../lib/ingestion/classification/classifyTechnologyByName";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const SAMPLE_NAMES = [
  "Ampliación El Triunfo",
  "AR PANIMAVIDA SOLAR",
  "Central Hidroeléctrica Rucalhue",
  "Híbrido Longotoma",
  "Proyecto NEHVTI",
  "BESS Halcón 6",
  "Coihueco III",
  "SP Saria",
  "Parque Fotovoltaico Don Edgard",
  "Línea 2x220 kV Nueva Charrúa - Nueva Temuco",
];

async function main() {
  const results = await classifyTechnologyByName(SAMPLE_NAMES);
  for (const r of results) {
    console.log(`${r.name.padEnd(45)} → ${String(r.technologyCode).padEnd(15)} (confianza ${r.confidence})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
