import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { classifyTechnologyByName } from "../lib/ingestion/classification/classifyTechnologyByName";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const BATCH_SIZE = 25; // nombres por llamada a Nemotron
const CONFIDENCE_THRESHOLD = 0.7;
const DATA_SOURCE_NAME = "Clasificación por nombre asistida por IA (Nemotron)";

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: dataSource, error: dsError } = await client
    .from("data_source")
    .select("id")
    .eq("name", DATA_SOURCE_NAME)
    .single();
  if (dsError || !dataSource) throw new Error(`No se encontró el data_source: ${dsError?.message}`);

  const { data: technologies, error: techError } = await client.from("technology").select("id, code");
  if (techError) throw new Error(`Error cargando tecnologías: ${techError.message}`);
  const techIdByCode = new Map((technologies ?? []).map((t) => [t.code, t.id as string]));

  const { data: projects, error: projError } = await client
    .from("project")
    .select("id, name")
    .is("technology_id", null)
    .range(0, 999); // el servidor cap a 1000 de todas formas; se re-corre si quedan más
  if (projError) throw new Error(`Error cargando proyectos: ${projError.message}`);

  console.log(`Proyectos a clasificar en esta corrida: ${projects?.length ?? 0}`);

  let classified = 0;
  let skipped = 0;

  for (let i = 0; i < (projects ?? []).length; i += BATCH_SIZE) {
    const batch = projects!.slice(i, i + BATCH_SIZE);
    console.log(`Lote ${i / BATCH_SIZE + 1}: ${batch.length} nombres...`);

    let results;
    try {
      results = await classifyTechnologyByName(batch.map((p) => p.name));
    } catch (err) {
      console.error(`  Error en el lote, se omite: ${err instanceof Error ? err.message : err}`);
      skipped += batch.length;
      continue;
    }

    for (let j = 0; j < batch.length; j++) {
      const project = batch[j];
      const result = results[j];
      if (!result || !result.technologyCode || result.confidence < CONFIDENCE_THRESHOLD) {
        skipped += 1;
        continue;
      }
      const technologyId = techIdByCode.get(result.technologyCode);
      if (!technologyId) {
        skipped += 1;
        continue;
      }

      // `includes_storage` marca proyectos de OTRA tecnología (solar/eólico) que
      // ADEMÁS incluyen batería como componente adicional — no aplica cuando la
      // tecnología clasificada YA ES "bess" (sería redundante: el nombre del
      // proyecto y su tecnología ya lo dicen). El clasificador solo entrega un
      // código de tecnología, nunca una señal aparte de "batería como add-on",
      // así que no hay caso legítimo en el que esta corrida deba tocar ese campo.
      const update: Record<string, unknown> = { technology_id: technologyId };

      const { error: updateError } = await client.from("project").update(update).eq("id", project.id);
      if (updateError) {
        console.error(`  Error actualizando '${project.name}': ${updateError.message}`);
        skipped += 1;
        continue;
      }

      await client.from("data_attribution").insert({
        entity_type: "project",
        entity_id: project.id,
        field_name: "technology_id",
        value: JSON.stringify(result.technologyCode),
        data_source_id: dataSource.id,
        confidence_level: "INTELIGENCIA_DE_MERCADO",
        verification_status: "unverified",
      });

      classified += 1;
    }
  }

  console.log(`\n--- Resumen ---`);
  console.log(`Clasificados (confianza ≥ ${CONFIDENCE_THRESHOLD}):`, classified);
  console.log("Sin clasificar (sin pista clara o confianza baja):", skipped);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
