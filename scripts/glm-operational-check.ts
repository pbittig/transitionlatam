// Prueba operacional del feature real de sugerencia de IA — usa exactamente
// el mismo código que quedó integrado en /admin/verificador (getGlmVerificationSuggestion
// + la misma lógica de candidatos SEIA que aiSuggestionActions.ts), corrido sobre una
// muestra de la cola real del Verificador (verified_at is null). No escribe nada en la
// base de datos — es solo para confirmar que opera bien a escala, no un piloto de acierto
// (eso ya se hizo en scripts/kimi-verification-pilot.ts, en la rama principal).
import { config } from "dotenv";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { getProjectById, type ProjectDetail } from "../lib/data-access/projects";
import { searchSeiaByName } from "../lib/ingestion/sources/seia/searchApi";
import { distinctiveTokens } from "../lib/ingestion/sources/seia/match";
import { getGlmVerificationSuggestion, type VerificationSuggestion } from "../lib/ai/verification/glmSuggestion";
import type { RawSeiaProject } from "../lib/ingestion/sources/seia/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local"), quiet: true } as unknown as { quiet: boolean });

const SAMPLE_SIZE = Number(process.argv[2] ?? "20");
const MAX_SEIA_CANDIDATES = 10;
const DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface CheckResult {
  project: ProjectDetail;
  candidates: RawSeiaProject[];
  suggestion: VerificationSuggestion | null;
  error: string | null;
  ms: number;
}

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: pending, error } = await client.from("project").select("id, name").is("verified_at", null).limit(2000);
  if (error) throw new Error(error.message);

  const sample = shuffle(pending ?? []).slice(0, SAMPLE_SIZE);
  console.log(`Cola real del Verificador: ${pending?.length ?? 0} proyectos pendientes — muestra: ${sample.length}`);

  const results: CheckResult[] = [];
  let i = 0;
  for (const p of sample) {
    i++;
    const start = Date.now();
    try {
      const project = await getProjectById(client, p.id as string);
      if (!project) {
        console.log(`  [${i}/${sample.length}] ${p.name} — proyecto ya no existe, se omite`);
        continue;
      }
      const searchTerm = distinctiveTokens(project.name).join(" ");
      const seiaResponse = searchTerm
        ? await searchSeiaByName(searchTerm, MAX_SEIA_CANDIDATES)
        : { data: [] as RawSeiaProject[] };
      const candidates = seiaResponse.data.slice(0, MAX_SEIA_CANDIDATES);

      const { suggestion, error: suggestionError } = await getGlmVerificationSuggestion(project, candidates);
      const ms = Date.now() - start;
      results.push({ project, candidates, suggestion, error: suggestionError, ms });
      console.log(
        `  [${i}/${sample.length}] ${project.name} — ${
          suggestionError
            ? `⚠️ ${suggestionError}`
            : `sanity=${suggestion?.dataSanity} pick=${suggestion?.seiaPick ?? "—"} (${candidates.length} candidatos, ${ms}ms)`
        }`,
      );
    } catch (err) {
      const ms = Date.now() - start;
      console.log(`  [${i}/${sample.length}] ${p.name} — excepción: ${(err as Error).message}`);
      results.push({
        project: { id: p.id, name: p.name } as ProjectDetail,
        candidates: [],
        suggestion: null,
        error: (err as Error).message,
        ms,
      });
    }
    await sleep(DELAY_MS);
  }

  const errors = results.filter((r) => r.error);
  const ok = results.filter((r) => r.suggestion?.dataSanity === "ok");
  const sospechoso = results.filter((r) => r.suggestion?.dataSanity === "sospechoso");
  const withPick = results.filter((r) => r.suggestion?.seiaPick);
  const withCandidates = results.filter((r) => r.candidates.length > 0);
  const avgMs = Math.round(results.reduce((sum, r) => sum + r.ms, 0) / (results.length || 1));

  console.log("\n--- Resumen operacional ---");
  console.log(`Procesados: ${results.length}`);
  console.log(`Errores: ${errors.length} (${Math.round((100 * errors.length) / results.length)}%)`);
  console.log(`Sanity ok: ${ok.length} / sospechoso: ${sospechoso.length}`);
  console.log(`Con candidatos SEIA reales: ${withCandidates.length} / con pick sugerido: ${withPick.length}`);
  console.log(`Tiempo promedio por proyecto: ${avgMs}ms`);

  const dateStr = new Date().toISOString().slice(0, 10);
  const lines: string[] = [
    `# Prueba operacional — sugerencia de IA del Verificador (${dateStr})`,
    "",
    `Muestra aleatoria de ${results.length} proyectos de la cola real del Verificador (de ${pending?.length ?? 0} pendientes). Corre el mismo código integrado en /admin/verificador — no un script aparte. Solo lectura, nada se escribió en la base de datos.`,
    "",
    `**Errores:** ${errors.length}/${results.length} (${Math.round((100 * errors.length) / results.length)}%) — **Sanity ok:** ${ok.length} — **Sospechoso:** ${sospechoso.length} — **Con candidatos SEIA:** ${withCandidates.length} — **Con pick sugerido:** ${withPick.length} — **Tiempo promedio:** ${avgMs}ms`,
    "",
    "---",
    "",
  ];
  for (const [idx, r] of results.entries()) {
    lines.push(`## ${idx + 1}. ${r.project.name}`);
    lines.push("");
    if (r.error) {
      lines.push(`⚠️ Error: ${r.error}`);
    } else if (r.suggestion) {
      lines.push(`- **Sanity:** ${r.suggestion.dataSanity} — ${r.suggestion.dataSanityReason}`);
      lines.push(`- **Candidatos SEIA:** ${r.candidates.length}`);
      lines.push(
        r.suggestion.seiaPick
          ? `- **Pick:** \`${r.suggestion.seiaPick}\` — ${r.suggestion.seiaPickReason}`
          : `- **Pick:** ninguno — ${r.suggestion.seiaPickReason}`,
      );
      lines.push(`- **Tiempo:** ${r.ms}ms`);
    }
    lines.push("");
  }

  const outPath = join(__dirname, "..", "docs", `glm-operational-check-${dateStr}.md`);
  await writeFile(outPath, lines.join("\n"), "utf8");
  console.log(`Reporte: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
