import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findBestSeiaMatch } from "../lib/ingestion/sources/seia/match";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

async function main() {
  const cases = [
    { name: "Parque Eólico Ovejera Sur", region: "Los Ríos" },
    { name: "Ovejera Sur", region: "Los Ríos" },
    { name: "BESS Halcón 5", region: "Antofagasta" },
    { name: "AR PANIMAVIDA SOLAR", region: "Maule" },
  ];
  for (const c of cases) {
    const result = await findBestSeiaMatch(c.name, c.region);
    console.log(c.name, "->", result ? `${result.candidate.EXPEDIENTE_NOMBRE} | ${result.candidate.ESTADO_PROYECTO} | confianza=${result.confidence}` : "sin match");
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
