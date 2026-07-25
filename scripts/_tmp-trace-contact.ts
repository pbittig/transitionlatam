import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: people, error } = await client
    .from("person")
    .select("id, full_name, email, phone")
    .or("full_name.ilike.%Arqueros%,email.ilike.%llandeta%,full_name.ilike.%Landeta%");
  if (error) throw error;

  console.log("--- Personas encontradas ---");
  console.log(JSON.stringify(people, null, 2));

  for (const person of people ?? []) {
    console.log(`\n--- Relaciones de ${person.full_name} (${person.id}) ---`);
    const { data: rels } = await client
      .from("entity_relationship")
      .select("relationship_type, target_type, target_id, data_source_id, confidence_level, created_at")
      .eq("source_type", "person")
      .eq("source_id", person.id);
    for (const r of rels ?? []) {
      let targetLabel = r.target_id;
      if (r.target_type === "company") {
        const { data: c } = await client.from("company").select("name, legal_name, rut").eq("id", r.target_id).maybeSingle();
        targetLabel = JSON.stringify(c);
      }
      const { data: ds } = await client.from("data_source").select("name").eq("id", r.data_source_id).maybeSingle();
      console.log(`  ${r.relationship_type} -> ${r.target_type} ${targetLabel} | fuente: ${ds?.name} | confianza: ${r.confidence_level} | creado: ${r.created_at}`);
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
