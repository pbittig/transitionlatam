// Audita los contactos extraídos del Formulario SAC (ver
// lib/ingestion/sources/energia-abierta/detalle-formulario/) para todos los proyectos con
// Formulario cargado: detecta correos ausentes o con formato inválido, y cargos que no
// corresponden a los 3 valores controlados que guarda load.ts (legal_representative,
// project_coordinator_1, project_coordinator_2) ni al fallback "signer" del camino
// verification_only — esos son texto libre extraído por IA y pueden venir en inglés,
// vacíos, o con basura (ver ALLOWED_CONTACT_ROLES en load.ts).
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const DATA_SOURCE_NAME = "Acceso Abierto - Coordinador Eléctrico Nacional (Formulario por proyecto)";
const KNOWN_ROLES = new Set(["legal_representative", "project_coordinator_1", "project_coordinator_2", "signer"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// PostgREST arma el .in() como querystring — con ~600+ UUIDs (36 chars c/u) la URL
// revienta el límite del cliente HTTP ("fetch failed"), así que se pagina en tandas.
const IN_BATCH_SIZE = 150;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function selectInBatches<T>(client: any, table: string, columns: string, column: string, ids: string[]): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += IN_BATCH_SIZE) {
    const batch = ids.slice(i, i + IN_BATCH_SIZE);
    const { data, error } = await client.from(table).select(columns).in(column, batch);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
  }
  return out;
}

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: source, error: sourceError } = await client
    .from("data_source")
    .select("id")
    .eq("name", DATA_SOURCE_NAME)
    .single();
  if (sourceError || !source) throw new Error(`No se encontró el data_source '${DATA_SOURCE_NAME}': ${sourceError?.message}`);

  const { data: links, error: linksError } = await client
    .from("entity_relationship")
    .select("relationship_type, source_id, target_id")
    .eq("source_type", "person")
    .eq("target_type", "company")
    .eq("data_source_id", source.id);
  if (linksError) throw new Error(linksError.message);
  if (!links?.length) {
    console.log("Sin contactos de Formulario cargados todavía.");
    return;
  }

  const personIds = [...new Set(links.map((l) => l.source_id as string))];
  const companyIds = [...new Set(links.map((l) => l.target_id as string))];

  type Person = { id: string; full_name: string; email: string | null; phone: string | null };
  type Company = { id: string; name: string | null };
  type Link = { source_id: string; target_id: string };

  const people = await selectInBatches<Person>(client, "person", "id, full_name, email, phone", "id", personIds);
  const peopleById = new Map(people.map((p) => [p.id, p]));

  const companies = await selectInBatches<Company>(client, "company", "id, name", "id", companyIds);
  const companiesById = new Map(companies.map((c) => [c.id, c]));

  // Nombres de proyecto por empresa, vía el vínculo project->developed_by->company que
  // arma linkCompanyAsSpv/loadFormularioResult — solo para contexto en el reporte.
  const developedByBatches = await Promise.all(
    Array.from({ length: Math.ceil(companyIds.length / IN_BATCH_SIZE) }, (_, i) =>
      companyIds.slice(i * IN_BATCH_SIZE, (i + 1) * IN_BATCH_SIZE),
    ).map((batch) =>
      client
        .from("entity_relationship")
        .select("source_id, target_id")
        .eq("source_type", "project")
        .eq("relationship_type", "developed_by")
        .eq("target_type", "company")
        .in("target_id", batch),
    ),
  );
  const developedBy: Link[] = developedByBatches.flatMap((r) => (r.data ?? []) as Link[]);
  const projects = await selectInBatches<{ id: string; name: string }>(
    client,
    "project",
    "id, name",
    "id",
    developedBy.map((d) => d.source_id),
  );
  const projectNameById = new Map(projects.map((p) => [p.id, p.name]));
  const projectNamesByCompanyId = new Map<string, string[]>();
  for (const d of developedBy) {
    const companyId = d.target_id as string;
    const projectName = projectNameById.get(d.source_id as string);
    if (!projectName) continue;
    const list = projectNamesByCompanyId.get(companyId) ?? [];
    list.push(projectName);
    projectNamesByCompanyId.set(companyId, list);
  }

  let totalContacts = 0;
  let missingEmail = 0;
  let invalidEmail = 0;
  let nonStandardRole = 0;
  const rows: string[] = [];

  const byCompany = new Map<string, typeof links>();
  for (const link of links) {
    const list = byCompany.get(link.target_id as string) ?? [];
    list.push(link);
    byCompany.set(link.target_id as string, list);
  }

  for (const [companyId, companyLinks] of byCompany) {
    const company = companiesById.get(companyId);
    const projectNames = projectNamesByCompanyId.get(companyId) ?? [];
    const label = `${company?.name ?? companyId}${projectNames.length ? ` (${projectNames.join(", ")})` : ""}`;

    for (const link of companyLinks) {
      const person = peopleById.get(link.source_id as string);
      if (!person) continue;
      totalContacts++;

      const role = link.relationship_type as string;
      const email = person.email as string | null;
      const issues: string[] = [];

      if (!email) {
        missingEmail++;
        issues.push("sin correo");
      } else if (!EMAIL_RE.test(email)) {
        invalidEmail++;
        issues.push(`correo con formato inválido (${email})`);
      }

      if (!KNOWN_ROLES.has(role)) {
        nonStandardRole++;
        issues.push(`cargo no estandarizado ("${role}")`);
      }

      if (issues.length > 0) {
        rows.push(`  [${label}] ${person.full_name} — ${issues.join("; ")}`);
      }
    }
  }

  console.log(`Contactos revisados: ${totalContacts} (${companiesById.size} empresas)`);
  if (rows.length > 0) {
    console.log("\nProblemas encontrados:");
    console.log(rows.join("\n"));
  }

  console.log("\n--- Resumen ---");
  console.log("Sin correo:", missingEmail);
  console.log("Correo con formato inválido:", invalidEmail);
  console.log("Cargo no estandarizado (texto libre de IA):", nonStandardRole);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
