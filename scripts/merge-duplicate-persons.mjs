// Fusiona fichas duplicadas de la misma persona en `person`.
//
// Cada Formulario procesado crea una fila nueva, así que una misma persona
// puede existir decenas de veces (36 fichas para el contacto más repetido).
// Eso infla el conteo de contactos y dispersa los datos: completar un teléfono
// lo completa en una sola de las copias.
//
// POR QUÉ .mjs Y NO .ts: usa `pg` directamente y el proyecto no tiene
// @types/pg, así que un .ts rompería `npm run typecheck`. Mismo criterio que
// scripts/run-migrations.mjs, el otro script que habla con Postgres directo.
//
// POR QUÉ `pg` Y NO supabase-js: la fusión tiene que ser atómica. Hay una clave
// foránea con ON DELETE CASCADE (company_shareholding.shareholder_person_id)
// que borra participaciones societarias en silencio si se elimina una persona
// sin repuntar antes. Sin transacción, un fallo a mitad de camino deja datos
// perdidos sin ningún error visible.
//
// Referencias a person que hay que repuntar ANTES de borrar:
//   - entity_relationship (source_type='person')  ~6554 filas, SIN clave foránea:
//     borrar deja relaciones huérfanas apuntando a un id inexistente.
//   - company_shareholding.shareholder_person_id  ON DELETE CASCADE  <- el peligroso
//   - opportunity.person_id                       NO ACTION (falla ruidosamente)
//
// Alcance: solo grupos sin ambigüedad, es decir con 0 o 1 correo distinto entre
// todas sus fichas. Los grupos con correos en conflicto se listan y NO se tocan:
// distinguir un typo de un cambio de empleador requiere criterio humano.
//
// Uso:
//   node scripts/merge-duplicate-persons.mjs            # simulación
//   node scripts/merge-duplicate-persons.mjs --apply    # aplica
import { config } from "dotenv";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pkg from "pg";

const { Client } = pkg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
config({ path: join(repoRoot, ".env.local") });

const apply = process.argv.includes("--apply");

/** Misma normalización que backfill-contact-emails.ts, para que ambos agrupen igual. */
function normalizeName(value) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Limpia el valor guardado: el parseo de PDF deja saltos de línea dentro del campo. */
function cleanValue(value) {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length ? cleaned : null;
}

function distinctEmails(group) {
  return [...new Set(group.map((p) => cleanValue(p.email)?.toLowerCase()).filter(Boolean))];
}

/**
 * Canónica = la ficha con más datos; a igualdad, la más antigua. La antigüedad
 * desempata a propósito: es la que más probablemente ya esté referenciada desde
 * otras partes del sistema.
 */
function pickCanonical(group) {
  const score = (p) => (cleanValue(p.email) ? 2 : 0) + (cleanValue(p.phone) ? 1 : 0);
  return [...group].sort((a, b) => score(b) - score(a) || a.created_at.localeCompare(b.created_at))[0];
}

/** La grafía a conservar: la más repetida del grupo; a igualdad, la más larga (suele traer tildes). */
function pickBestSpelling(group) {
  const counts = new Map();
  for (const p of group) counts.set(p.full_name, (counts.get(p.full_name) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0];
}

async function main() {
  const client = new Client({
    host: process.env.SUPABASE_DB_HOST,
    port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
    user: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    database: process.env.SUPABASE_DB_NAME ?? "postgres",
    ssl: { ca: readFileSync(join(repoRoot, "supabase", "certs", "supabase-root-2021-ca.pem"), "utf8") },
  });
  await client.connect();

  const { rows } = await client.query("select id, full_name, email, phone, created_at::text from person");

  const groups = new Map();
  for (const row of rows) {
    const key = normalizeName(row.full_name);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const duplicated = [...groups.values()].filter((g) => g.length > 1);
  const conflicted = duplicated.filter((g) => distinctEmails(g).length > 1);
  const mergeable = duplicated.filter((g) => distinctEmails(g).length <= 1);

  const plan = mergeable.map((group) => {
    const canonical = pickCanonical(group);
    const duplicates = group.filter((p) => p.id !== canonical.id);
    return {
      name: pickBestSpelling(group),
      canonicalId: canonical.id,
      duplicateIds: duplicates.map((p) => p.id),
      email: cleanValue(canonical.email) ?? cleanValue(group.find((p) => cleanValue(p.email))?.email ?? null),
      phone: cleanValue(canonical.phone) ?? cleanValue(group.find((p) => cleanValue(p.phone))?.phone ?? null),
      rowsBefore: group.map((p) => ({ id: p.id, full_name: p.full_name, email: p.email, phone: p.phone })),
    };
  });

  // Volcado previo: sin esto la fusión no es reversible, porque las filas
  // borradas no dejan rastro.
  const logDir = join(repoRoot, "logs");
  mkdirSync(logDir, { recursive: true });
  const dumpPath = join(logDir, "merge-persons-plan.json");
  writeFileSync(
    dumpPath,
    JSON.stringify(
      { plan, conflicted: conflicted.map((g) => ({ name: g[0].full_name, emails: distinctEmails(g) })) },
      null,
      2,
    ),
    "utf8",
  );

  let relationsRepointed = 0;
  let relationsDeduped = 0;
  let personsDeleted = 0;

  if (apply) {
    await client.query("begin");
    try {
      for (const item of plan) {
        if (!item.duplicateIds.length) continue;
        const ids = item.duplicateIds;

        const rel = await client.query(
          "update entity_relationship set source_id = $1 where source_type = 'person' and source_id = any($2::uuid[])",
          [item.canonicalId, ids],
        );
        relationsRepointed += rel.rowCount ?? 0;

        await client.query(
          "update company_shareholding set shareholder_person_id = $1 where shareholder_person_id = any($2::uuid[])",
          [item.canonicalId, ids],
        );
        await client.query("update opportunity set person_id = $1 where person_id = any($2::uuid[])", [
          item.canonicalId,
          ids,
        ]);

        // entity_relationship no tiene índice único sobre (origen, destino, tipo),
        // así que repuntar deja filas idénticas repetidas. Se conserva una.
        const dedup = await client.query(
          `delete from entity_relationship a using entity_relationship b
           where a.ctid > b.ctid
             and a.source_type = b.source_type and a.source_id = b.source_id
             and a.target_type = b.target_type and a.target_id = b.target_id
             and a.relationship_type = b.relationship_type
             and a.source_type = 'person' and a.source_id = $1`,
          [item.canonicalId],
        );
        relationsDeduped += dedup.rowCount ?? 0;

        await client.query(
          "update person set full_name = $2, email = coalesce($3, email), phone = coalesce($4, phone), updated_at = now() where id = $1",
          [item.canonicalId, item.name, item.email, item.phone],
        );

        const del = await client.query("delete from person where id = any($1::uuid[])", [ids]);
        personsDeleted += del.rowCount ?? 0;
      }
      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      throw err;
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        personRowsBefore: rows.length,
        distinctNames: groups.size,
        duplicatedGroups: duplicated.length,
        mergeableGroups: plan.length,
        conflictedGroups: conflicted.length,
        rowsToDelete: plan.reduce((sum, item) => sum + item.duplicateIds.length, 0),
        ...(apply ? { relationsRepointed, relationsDeduped, personsDeleted } : {}),
        planDump: dumpPath,
      },
      null,
      2,
    ),
  );

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
