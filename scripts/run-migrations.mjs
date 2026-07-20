import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { Client } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "supabase", "migrations");

config({ path: join(__dirname, "..", ".env.local") });

// Supabase's direct DB connections are signed by their own private CA, not a
// publicly-trusted one — verify against it explicitly instead of disabling
// verification. See supabase/certs/README.md.
const supabaseCa = readFileSync(
  join(__dirname, "..", "supabase", "certs", "supabase-root-2021-ca.pem"),
  "utf8",
);

const client = new Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME ?? "postgres",
  ssl: { ca: supabaseCa },
});

async function main() {
  await client.connect();
  console.log("Conectado a", process.env.SUPABASE_DB_HOST);

  await client.query(`
    create table if not exists _migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const { rows: applied } = await client.query("select name from _migrations");
  const appliedSet = new Set(applied.map((r) => r.name));

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`- ${file}: ya aplicada, se omite`);
      continue;
    }
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    console.log(`- ${file}: aplicando...`);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into _migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log(`  OK`);
    } catch (err) {
      await client.query("rollback");
      console.error(`  FALLÓ: ${err.message}`);
      throw err;
    }
  }

  console.log("Todas las migraciones aplicadas.");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
