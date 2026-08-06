// Recalcula el proyecto sugerido para todas las pertinencias pendientes con
// la lógica de matching actual (RUT del titular primero, nombre como
// respaldo). Correr una vez después de cambiar matching.ts — las corridas
// diarias normales solo recalculan filas nuevas/cambiadas, no todo el backlog.
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSupabaseServiceClient } from "../lib/data-access/supabase-service-client";
import { suggestProjectMatch, loadProjectCandidates } from "../lib/ingestion/sources/sea-pertinencia/matching";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

async function main() {
  const client = createSupabaseServiceClient();
  const candidates = await loadProjectCandidates(client);

  const rows: { id: string; name: string; titular_rut: string | null; suggested_project_id: string | null; suggested_match_score: number | null }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from("pertinencia_consulta")
      .select("id, name, titular_rut, suggested_project_id, suggested_match_score")
      .eq("match_status", "pending")
      .range(offset, offset + 999);
    if (error) throw new Error(`Error cargando pertinencias pendientes: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  let changed = 0;
  let rutMatches = 0;
  for (const row of rows) {
    const candidate = suggestProjectMatch(row.name, candidates, row.titular_rut);
    if (!candidate) continue;
    if (candidate.matchedBy === "rut") rutMatches += 1;
    if (candidate.projectId === row.suggested_project_id && candidate.score === row.suggested_match_score) continue;

    const { error: updateError } = await client
      .from("pertinencia_consulta")
      .update({ suggested_project_id: candidate.projectId, suggested_match_score: candidate.score })
      .eq("id", row.id);
    if (updateError) throw new Error(`Error actualizando pertinencia ${row.id}: ${updateError.message}`);
    changed += 1;
  }

  console.log(`Pendientes revisadas: ${rows.length}`);
  console.log(`Con match por RUT: ${rutMatches}`);
  console.log(`Sugerencias actualizadas: ${changed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
