// scripts/screen-verification-queue.ts
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { getProjectById, saveAiScreeningResult } from "../lib/data-access/projects";
import { searchSeiaByName } from "../lib/ingestion/sources/seia/searchApi";
import { distinctiveTokens } from "../lib/ingestion/sources/seia/match";
import { getGlmVerificationSuggestion } from "../lib/ai/verification/glmSuggestion";
import type { RawSeiaProject } from "../lib/ingestion/sources/seia/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const BATCH_SIZE = Number(process.argv[2] ?? "50");
const DELAY_MS = 400; // no golpear el servidor público de SEIA ni el rate limit de GLM sin pausas
const MAX_SEIA_CANDIDATES = 10;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: pending, error } = await client
    .from("project")
    .select("id")
    .is("verified_at", null)
    .is("ai_screened_at", null)
    .limit(BATCH_SIZE);
  if (error) throw new Error(error.message);

  console.log(`Proyectos pendientes de tamizar en esta corrida: ${(pending ?? []).length}.`);

  let screened = 0;
  let sospechosos = 0;
  let conPick = 0;
  let errors = 0;

  for (const row of pending ?? []) {
    const projectId = row.id as string;
    const start = Date.now();
    try {
      const project = await getProjectById(client, projectId);
      if (!project) {
        errors++;
        console.log(`  [error] ${projectId}: proyecto no encontrado`);
        continue;
      }

      const searchTerm = distinctiveTokens(project.name).join(" ");
      const seiaResponse = searchTerm
        ? await searchSeiaByName(searchTerm, MAX_SEIA_CANDIDATES)
        : { data: [] as RawSeiaProject[] };
      const candidates = seiaResponse.data.slice(0, MAX_SEIA_CANDIDATES);

      const { suggestion, error: glmError } = await getGlmVerificationSuggestion(project, candidates);
      if (glmError || !suggestion) {
        errors++;
        console.log(`  [error] ${project.name}: ${glmError ?? "GLM no devolvió una sugerencia"}`);
        continue;
      }

      await saveAiScreeningResult(client, projectId, suggestion);
      screened++;
      if (suggestion.dataSanity === "sospechoso") sospechosos++;
      if (suggestion.seiaPick) conPick++;
      console.log(
        `  [${suggestion.dataSanity}] ${project.name}${suggestion.seiaPick ? ` -> candidato ${suggestion.seiaPick}` : ""} (${Date.now() - start}ms)`,
      );
    } catch (err) {
      errors++;
      console.log(`  [error] ${projectId}: ${(err as Error).message}`);
    }
    await sleep(DELAY_MS);
  }

  console.log("\n--- Resumen ---");
  console.log("Tamizados:", screened);
  console.log("Sospechosos:", sospechosos);
  console.log("Con candidato SEIA sugerido:", conPick);
  console.log("Errores:", errors);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
