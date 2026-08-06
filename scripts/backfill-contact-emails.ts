import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const apply = process.argv.includes("--apply");
const verbose = process.argv.includes("--verbose");
const PAGE_SIZE = 1000;

function normalizeName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function emailMatchesName(name: string, email: string) {
  const localPart = normalizeName(email.split("@")[0]).replaceAll(" ", "");
  const words = normalizeName(name).split(" ").filter((word) => word.length >= 2);
  const initials = words.map((word) => word[0]).join("");
  const firstName = words[0] ?? "";
  const surnames = words.slice(1).filter((word) => word.length >= 3);
  return (
    (firstName.length >= 3 && localPart.includes(firstName)) ||
    (localPart.startsWith(firstName[0] ?? "") && surnames.some((surname) => localPart.includes(surname))) ||
    (localPart.length <= 4 && localPart === initials)
  );
}

async function readAll<T>(queryPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await queryPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan credenciales de Supabase.");
  const client = createClient(url, key, { auth: { persistSession: false } });

  const people = await readAll<{ id: string; full_name: string; email: string | null }>(
    (from, to) => client.from("person").select("id, full_name, email").order("id").range(from, to),
  );
  const peopleByName = new Map<string, Array<{ id: string; full_name: string; email: string | null }>>();
  for (const person of people) {
    const key = normalizeName(person.full_name);
    if (!key) continue;
    const group = peopleByName.get(key) ?? [];
    group.push(person);
    peopleByName.set(key, group);
  }

  const candidates: Array<{ id: string; name: string; email: string }> = [];
  for (const group of peopleByName.values()) {
    const missing = group.filter((person) => !person.email);
    const donors = group.filter((person) => person.email && emailMatchesName(person.full_name, person.email));
    for (const person of missing) {
      const emails = [...new Set(donors.map((donor) => donor.email!.trim().toLowerCase()))];
      if (emails.length === 1) candidates.push({ id: person.id, name: person.full_name, email: emails[0] });
    }
  }

  if (apply) {
    for (const candidate of candidates) {
      const { error } = await client.from("person").update({ email: candidate.email }).eq("id", candidate.id);
      if (error) throw new Error(`${candidate.name}: ${error.message}`);
    }
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", people: people.length, candidates: candidates.length, ...(verbose ? { updates: candidates } : {}) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
