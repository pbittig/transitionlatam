// scripts/screen-verification-queue.ts
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { getProjectById, saveAiScreeningResult, REJECTED_STATUSES, startOfCurrentMonthIso } from "../lib/data-access/projects";
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

  const startOfMonth = startOfCurrentMonthIso();
  const [{ data: esperados, error: e1 }, { data: resto, error: e2 }] = await Promise.all([
    client
      .from("project")
      .select("id")
      .is("verified_at", null)
      .is("ai_screened_at", null)
      .not("status", "in", `(${REJECTED_STATUSES.join(",")})`)
      .gte("estimated_connection_date", startOfMonth)
      .order("estimated_connection_date", { ascending: true })
      .limit(BATCH_SIZE),
    client
      .from("project")
      .select("id")
      .is("verified_at", null)
      .is("ai_screened_at", null)
      .or(
        `status.in.(${REJECTED_STATUSES.join(",")}),estimated_connection_date.lt.${startOfMonth},estimated_connection_date.is.null`,
      )
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);

  const seen = new Set<string>();
  const pending = [...(esperados ?? []), ...(resto ?? [])].filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  }).slice(0, BATCH_SIZE);

  console.log(`Proyectos pendientes de tamizar en esta corrida: ${pending.length}.`);

  let screened = 0;
  let sospechosos = 0;
  let conPick = 0;
  let errors = 0;

  for (const row of pending) {
    const projectId = row.id as string;
    const start = Date.now();
    try {
      const project = await getProjectById(client, projectId);
      if (!project) {
        errors++;
        console.log(`  [error] ${projectId}: proyecto no encontrado`);
      } else {
        const searchTerm = distinctiveTokens(project.name).join(" ");
        const seiaResponse = searchTerm
          ? await searchSeiaByName(searchTerm, MAX_SEIA_CANDIDATES)
          : { data: [] as RawSeiaProject[] };
        const candidates = seiaResponse.data.slice(0, MAX_SEIA_CANDIDATES);

        const { suggestion, error: glmError } = await getGlmVerificationSuggestion(project, candidates);
        if (glmError || !suggestion) {
          errors++;
          console.log(`  [error] ${project.name}: ${glmError ?? "GLM no devolvió una sugerencia"}`);
        } else {
          await saveAiScreeningResult(client, projectId, suggestion);
          screened++;
          if (suggestion.dataSanity === "sospechoso") sospechosos++;
          if (suggestion.seiaPick) conPick++;
          console.log(
            `  [${suggestion.dataSanity}] ${project.name}${suggestion.seiaPick ? ` -> candidato ${suggestion.seiaPick}` : ""} (${Date.now() - start}ms)`,
          );
        }
      }
    } catch (err) {
      errors++;
      console.log(`  [error] ${projectId}: ${(err as Error).message}`);
    } finally {
      await sleep(DELAY_MS);
    }
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
