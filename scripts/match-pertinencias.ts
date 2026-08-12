/**
 * Confirma los vínculos pertinencia ↔ proyecto que tienen evidencia triple, y
 * deja el resto para revisión humana en /admin/pertinencias.
 *
 *   npx tsx scripts/match-pertinencias.ts            # simulación (no escribe)
 *   npx tsx scripts/match-pertinencias.ts --apply
 *
 * POR QUÉ UNA REGLA Y NO EL SCORE SOLO. La sugerencia existente cruza por RUT
 * del titular o por similitud de nombre (Jaccard sobre tokens distintivos, ver
 * sea-pertinencia/matching.ts). Un score de 100 significa "los tokens
 * distintivos son idénticos", y por sí solo NO alcanza: "PARQUE SOLAR AMBAR"
 * (Cabrero, Biobío) matchea 100 con "PE Ámbar" (Vallenar, Atacama), a 1.500 km
 * y además eólico. De 281 sugerencias con score 100, sólo 131 coinciden también
 * en comuna y región.
 *
 * La regla que se aplica exige las tres cosas: tokens de nombre idénticos,
 * misma comuna y misma región. Las tres vienen de fuentes distintas del mismo
 * expediente, así que una coincidencia triple por azar es difícil.
 *
 * Todo lo que confirma queda marcado con `match_confirmed_by`, así que el lote
 * es identificable y reversible sin tocar lo confirmado por una persona.
 */
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const MATCH_RULE = "auto_name_region_comuna";

/** Sin tildes, sin mayúsculas, sin espacios de más — para comparar comuna y región entre fuentes que las escriben distinto. */
function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** "Región de Antofagasta" y "Antofagasta" son la misma región; el SEA escribe la primera forma y el Coordinador la segunda. */
function regionMatches(pertinenciaRegion: string | null, projectRegion: string | null): boolean {
  const a = normalizeText(pertinenciaRegion).replace(/^region\s+(de\s+|del\s+|de\s+la\s+)?/, "");
  const b = normalizeText(projectRegion).replace(/^region\s+(de\s+|del\s+|de\s+la\s+)?/, "");
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

interface PendingRow {
  id: string;
  name: string;
  region: string | null;
  comuna: string | null;
  suggested_project_id: string;
  suggested_match_score: number | null;
  project: { id: string; name: string; location: { comuna: string | null; region: { name: string } | null } | null } | null;
}

async function loadPending(client: SupabaseClient): Promise<PendingRow[]> {
  const rows: PendingRow[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await client
      .from("pertinencia_consulta")
      .select(
        "id, name, region, comuna, suggested_project_id, suggested_match_score, project:suggested_project_id(id, name, location:location_id(comuna, region:region_id(name)))",
      )
      .eq("match_status", "pending")
      .not("suggested_project_id", "is", null)
      .order("id")
      .range(from, from + 499);
    if (error) throw new Error(`Error leyendo pertinencias pendientes: ${error.message}`);
    const batch = (data ?? []) as unknown as PendingRow[];
    rows.push(...batch);
    if (batch.length < 500) return rows;
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const serviceRoleFetch: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    if (headers.get("authorization")?.startsWith("Bearer sb_secret_")) headers.delete("authorization");
    return fetch(input, { ...init, headers });
  };
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    global: { fetch: serviceRoleFetch },
  });

  const pending = await loadPending(client);
  const confirmable: PendingRow[] = [];
  const reasons = { sinScore100: 0, comunaDistinta: 0, regionDistinta: 0, sinUbicacion: 0 };

  for (const row of pending) {
    if (Number(row.suggested_match_score) !== 100) {
      reasons.sinScore100++;
      continue;
    }
    const projectComuna = row.project?.location?.comuna ?? null;
    const projectRegion = row.project?.location?.region?.name ?? null;
    if (!projectComuna || !projectRegion || !row.comuna || !row.region) {
      reasons.sinUbicacion++;
      continue;
    }
    if (normalizeText(row.comuna) !== normalizeText(projectComuna)) {
      reasons.comunaDistinta++;
      continue;
    }
    if (!regionMatches(row.region, projectRegion)) {
      reasons.regionDistinta++;
      continue;
    }
    confirmable.push(row);
  }

  console.log(`Pendientes con sugerencia:        ${pending.length}`);
  console.log(`Confirmables (nombre+comuna+región): ${confirmable.length}`);
  console.log(`Quedan para revisión humana:      ${pending.length - confirmable.length}`);
  console.log(`  · score de nombre < 100:        ${reasons.sinScore100}`);
  console.log(`  · comuna distinta:              ${reasons.comunaDistinta}`);
  console.log(`  · región distinta:              ${reasons.regionDistinta}`);
  console.log(`  · sin ubicación comparable:     ${reasons.sinUbicacion}`);

  console.log("\nMuestra de lo que se confirmaría:");
  for (const row of confirmable.slice(0, 5)) {
    console.log(`  "${row.name}" (${row.comuna})  ->  "${row.project?.name}"`);
  }

  if (!apply) {
    console.log("\nSimulación: no se escribió nada. Repetir con --apply para confirmar.");
    return;
  }

  const confirmedAt = new Date().toISOString();
  let updated = 0;
  for (const row of confirmable) {
    const { error } = await client
      .from("pertinencia_consulta")
      .update({
        matched_project_id: row.suggested_project_id,
        match_status: "confirmed",
        match_confirmed_by: MATCH_RULE,
        match_confirmed_at: confirmedAt,
      })
      .eq("id", row.id)
      .eq("match_status", "pending"); // no pisa nada que una persona haya tocado mientras corría
    if (error) throw new Error(`Error confirmando ${row.id}: ${error.message}`);
    updated++;
  }
  console.log(`\nConfirmados: ${updated} (marcados como "${MATCH_RULE}", reversibles por lote).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
