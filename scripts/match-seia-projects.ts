import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { findBestSeiaMatch } from "../lib/ingestion/sources/seia/match";
import { saveSeiaMatch } from "../lib/ingestion/sources/seia/load";
import { loadPendingPertinenciaCandidates, suggestPertinenciaForProject } from "../lib/ingestion/sources/sea-pertinencia/matching";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const BATCH_SIZE = Number(process.argv[2] ?? "100");
const DELAY_MS = 400; // no golpear el servidor público de SEIA sin pausas

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: alreadyMatched } = await client.from("seia_record").select("project_id").not("project_id", "is", null);
  const matchedIds = new Set((alreadyMatched ?? []).map((r) => r.project_id as string));

  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);

  const { data: projects, error } = await client
    .from("project")
    .select("id, name, location:location_id(region:region_id(name)), developer:developer_company_id(name, rut)")
    .gte("estimated_connection_date", startOfMonth)
    .not("status", "in", "(Rechazada,Desistida)")
    .limit(2000);

  if (error) throw new Error(error.message);

  const pending = (projects ?? []).filter((p) => !matchedIds.has(p.id as string)).slice(0, BATCH_SIZE);
  console.log(`Proyectos esperados sin match SEIA: ${(projects ?? []).length - matchedIds.size} — procesando ${pending.length} en esta corrida.`);

  // Cargado una vez, reutilizado en cada intento sin match SEIA — ver
  // suggestPertinenciaForProject (lib/ingestion/sources/sea-pertinencia/matching.ts).
  const pertinenciaCandidates = await loadPendingPertinenciaCandidates(client);

  let matched = 0;
  let noMatch = 0;
  let pertinenciaFallbackSuggested = 0;
  let errors = 0;

  for (const project of pending) {
    const region = (project as unknown as { location: { region: { name: string } | null } | null }).location?.region?.name ?? null;
    const developer = (project as unknown as { developer: { name: string; rut: string | null } | null }).developer ?? null;
    try {
      const result = await findBestSeiaMatch(project.name as string, region, developer?.name ?? null);
      if (result) {
        await saveSeiaMatch(client, project.id as string, result.candidate, result.confidence);
        matched++;
        console.log(`  [match ${result.confidence}] ${project.name} -> ${result.candidate.EXPEDIENTE_NOMBRE} (${result.candidate.ESTADO_PROYECTO})`);
      } else {
        noMatch++;
        // Sin expediente SEIA: probamos Pertinencia como respaldo antes de dejarlo
        // sin nada — nunca confirma sola, solo deja la sugerencia lista para
        // revisar en /admin/pertinencias (mismo criterio semi-asistido de siempre).
        const suggestion = suggestPertinenciaForProject(project.name as string, developer?.rut ?? null, pertinenciaCandidates);
        if (suggestion) {
          const { error: updateError } = await client
            .from("pertinencia_consulta")
            .update({ suggested_project_id: project.id, suggested_match_score: suggestion.score })
            .eq("id", suggestion.pertinenciaId);
          if (updateError) throw new Error(updateError.message);
          pertinenciaFallbackSuggested++;
          console.log(`  [fallback pertinencia ${suggestion.matchedBy} ${suggestion.score}] ${project.name} -> ${suggestion.pertinenciaName}`);
        }
      }
    } catch (err) {
      errors++;
      console.log(`  [error] ${project.name}: ${(err as Error).message}`);
    }
    await sleep(DELAY_MS);
  }

  console.log("\n--- Resumen ---");
  console.log("Procesados:", pending.length);
  console.log("Con match SEIA:", matched);
  console.log("Sin match SEIA:", noMatch);
  console.log("  de los cuales, con sugerencia de Pertinencia como respaldo:", pertinenciaFallbackSuggested);
  console.log("Errores:", errors);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
