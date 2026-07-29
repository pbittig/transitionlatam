import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const INFRASTRUCTURE =
  /\b(alimentador(?:es)?|subestaci[oó]n(?:es)?|s\/?e\b|l[ií]nea(?:s)?(?:\s+de)?\s+(?:transmisi[oó]n|alta tensi[oó]n)|pa[nñ]o\s+[a-z]?\d+|tap\s*off)\b/i;
const ENERGY_PROJECT =
  /\b(bess|bater[ií]a(?:s)?|almacenamiento|solar|fotovoltaic[oa]|e[oó]lic[oa]|hidroel[eé]ctric[oa]|geot[eé]rmic[oa]|termoel[eé]ctric[oa]|biomasa|generaci[oó]n|pmgd|pfv)\b/i;
const DATA_CENTER = /\b(data\s*cent(?:er|re)|centro\s+de\s+datos)\b/i;
const CLEAR_NON_ENERGY =
  /\b(desal(?:adora|inizaci[oó]n)|impulsi[oó]n\s+de\s+agua|suministro\s+de\s+agua|bombeo|campamento|minera|miner[ií]a|mina\b|riego|consumo|demanda)\b/i;

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const rows: Array<{
    id: string;
    name: string;
    verified_at: string | null;
    estimated_connection_date: string | null;
    status: string | null;
    project_kind: string | null;
    technology: { code: string } | Array<{ code: string }> | null;
  }> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from("project")
      .select("id, name, verified_at, estimated_connection_date, status, project_kind, technology:technology_id(code)")
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) break;
  }
  const matching = rows.filter((row) => INFRASTRUCTURE.test(row.name));
  const isEnergySignal = (row: (typeof rows)[number]) => ENERGY_PROJECT.test(row.name);
  const isDataCenter = (row: (typeof rows)[number]) => DATA_CENTER.test(row.name);
  const isConsumption = (row: (typeof rows)[number]) =>
    row.project_kind === "consumption" ||
    (Array.isArray(row.technology) ? row.technology[0]?.code : row.technology?.code) === "consumption";
  const standalone = matching.filter((row) => !isEnergySignal(row) && !isDataCenter(row));
  const nonEnergyConsumption = rows.filter(
    (row) =>
      !isDataCenter(row) &&
      !isEnergySignal(row) &&
      (isConsumption(row) || CLEAR_NON_ENERGY.test(row.name)),
  );
  const deletionMap = new Map([...standalone, ...nonEnergyConsumption].map((row) => [row.id, row]));
  const deletionCandidates = [...deletionMap.values()];
  const ambiguous = rows.filter(
    (row) =>
      !deletionMap.has(row.id) &&
      !isDataCenter(row) &&
      ((INFRASTRUCTURE.test(row.name) && isEnergySignal(row)) ||
        (CLEAR_NON_ENERGY.test(row.name) && isEnergySignal(row))),
  );
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const current = deletionCandidates.filter(
    (row) =>
      row.verified_at === null &&
      row.status !== "Rechazada" &&
      row.status !== "Desistida" &&
      !!row.estimated_connection_date &&
      row.estimated_connection_date >= monthStart.toISOString().slice(0, 10),
  );
  console.log(JSON.stringify({
    totalProjects: rows.length,
    infrastructureNameMatches: matching.length,
    standaloneInfrastructureCandidates: standalone.length,
    nonEnergyConsumptionCandidates: nonEnergyConsumption.length,
    totalUniqueDeletionCandidates: deletionCandidates.length,
    currentPendingDeletionCandidates: current.length,
    ambiguousKeepForReview: ambiguous.length,
    deletionSample: deletionCandidates.slice(0, 50).map(({ id, name, project_kind, technology }) => ({
      id,
      name,
      projectKind: project_kind,
      technologyCode: (Array.isArray(technology) ? technology[0]?.code : technology?.code) ?? null,
    })),
    ambiguousSample: ambiguous.slice(0, 30).map(({ id, name }) => ({ id, name })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
