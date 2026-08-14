import { config } from "dotenv";
import { Client } from "pg";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
config({ path: join(scriptDirectory, "..", ".env.local") });

const INFRASTRUCTURE =
  /\b(alimentador(?:es)?|subestaci[oó]n(?:es)?|s\/?e\b|l[ií]nea(?:s)?(?:\s+de)?\s+(?:transmisi[oó]n|alta tensi[oó]n)|pa[nñ]o\s+[a-z]?\d+|tap\s*off)\b/i;
const ENERGY_PROJECT =
  /\b(bess|bater[ií]a(?:s)?|almacenamiento|solar|fotovoltaic[oa]|e[oó]lic[oa]|hidroel[eé]ctric[oa]|geot[eé]rmic[oa]|termoel[eé]ctric[oa]|biomasa|generaci[oó]n|pmgd|pfv)\b/i;
const DATA_CENTER = /\b(data\s*cent(?:er|re)|centro\s+de\s+datos)\b/i;
const CLEAR_NON_ENERGY =
  /\b(desal(?:adora|inizaci[oó]n)|impulsi[oó]n\s+de\s+agua|suministro\s+de\s+agua|bombeo|campamento|minera|miner[ií]a|mina\b|riego|consumo|demanda)\b/i;

interface ProjectCandidate {
  id: string;
  name: string;
  project_kind: string | null;
  technology_code: string | null;
}

function shouldDelete(row: ProjectCandidate): boolean {
  if (DATA_CENTER.test(row.name) || ENERGY_PROJECT.test(row.name)) return false;
  const infrastructure = INFRASTRUCTURE.test(row.name);
  const consumption = row.project_kind === "consumption" || row.technology_code === "consumption";
  return infrastructure || consumption || CLEAR_NON_ENERGY.test(row.name);
}

async function rowsIfTableExists(client: Client, table: string, where: string, ids: string[]) {
  try {
    const result = await client.query(`select * from ${table} where ${where}`, [ids]);
    return result.rows;
  } catch (error) {
    if ((error as { code?: string }).code === "42P01") return [];
    throw error;
  }
}

async function main() {
  if (!process.argv.includes("--apply")) throw new Error("Este script exige --apply.");
  const ca = await readFile(join(scriptDirectory, "..", "supabase", "certs", "supabase-root-2021-ca.pem"), "utf8");
  const client = new Client({
    host: process.env.SUPABASE_DB_HOST,
    port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
    user: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    database: process.env.SUPABASE_DB_NAME ?? "postgres",
    ssl: { ca },
  });
  await client.connect();
  try {
    const { rows } = await client.query<ProjectCandidate>(`
      select p.id, p.name, p.project_kind, t.code as technology_code
      from project p
      left join technology t on t.id = p.technology_id
      order by p.id
    `);
    const candidates = rows.filter((row: ProjectCandidate) => shouldDelete(row));
    const ids = candidates.map((row: ProjectCandidate) => row.id);
    if (!ids.length) {
      console.log(JSON.stringify({ deleted: 0, message: "No hay candidatos." }, null, 2));
      return;
    }

    const archive = {
      createdAt: new Date().toISOString(),
      reason: "Infraestructura eléctrica independiente y consumo no energético; data centers y casos energéticos/dudosos conservados.",
      candidates,
      project: (await client.query("select * from project where id = any($1::uuid[])", [ids])).rows,
      project_connection: await rowsIfTableExists(client, "project_connection", "project_id = any($1::uuid[])", ids),
      formulario_ingest_log: await rowsIfTableExists(client, "formulario_ingest_log", "project_id = any($1::uuid[])", ids),
      project_preverification: await rowsIfTableExists(client, "project_preverification", "project_id = any($1::uuid[])", ids),
      seia_record: await rowsIfTableExists(client, "seia_record", "project_id = any($1::uuid[])", ids),
      project_event: await rowsIfTableExists(client, "project_event", "project_id = any($1::uuid[])", ids),
      opportunity: await rowsIfTableExists(client, "opportunity", "project_id = any($1::uuid[])", ids),
      followed_project: await rowsIfTableExists(client, "followed_project", "project_id = any($1::uuid[])", ids),
      entity_relationship: await rowsIfTableExists(
        client,
        "entity_relationship",
        "(source_type = 'project' and source_id = any($1::uuid[])) or (target_type = 'project' and target_id = any($1::uuid[]))",
        ids,
      ),
    };
    const archivePath = resolve(
      "docs",
      `deleted-non-energy-projects-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );
    await writeFile(archivePath, JSON.stringify(archive, null, 2), "utf8");

    await client.query("begin");
    try {
      await client.query("delete from formulario_ingest_log where project_id = any($1::uuid[])", [ids]);
      const deleted = await client.query("delete from project where id = any($1::uuid[]) returning id, name", [ids]);
      if (deleted.rowCount !== candidates.length) {
        throw new Error(`Se esperaban ${candidates.length} eliminaciones y PostgreSQL devolvió ${deleted.rowCount}.`);
      }
      await client.query("commit");
      console.log(JSON.stringify({
        deleted: deleted.rowCount,
        archivePath,
        keptDataCenters: rows.filter((row: ProjectCandidate) => DATA_CENTER.test(row.name)).length,
        keptAmbiguousEnergySignals: rows.filter(
          (row: ProjectCandidate) =>
            !DATA_CENTER.test(row.name) &&
            ENERGY_PROJECT.test(row.name) &&
            (INFRASTRUCTURE.test(row.name) || CLEAR_NON_ENERGY.test(row.name)),
        ).length,
      }, null, 2));
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
