import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { parseFormulario } from "../lib/ingestion/sources/energia-abierta/detalle-formulario";
import { loadFormularioResult } from "../lib/ingestion/sources/energia-abierta/detalle-formulario/load";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

async function main() {
  const [projectExternalId, filePath] = process.argv.slice(2);
  if (!projectExternalId || !filePath) {
    console.error("Uso: tsx scripts/ingest-formulario.ts <external_reference_del_proyecto> <ruta_archivo>");
    process.exit(1);
  }

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: project, error } = await client
    .from("project")
    .select("id, name")
    .eq("external_reference", projectExternalId)
    .single();
  if (error || !project) {
    console.error(`No se encontró un proyecto con external_reference='${projectExternalId}': ${error?.message}`);
    process.exit(1);
  }
  console.log(`Proyecto: ${project.name} (${project.id})`);

  console.log(`Parseando ${filePath}...`);
  const result = await parseFormulario(filePath);
  console.log(`Tipo de resultado: ${result.kind}`);
  console.log(JSON.stringify(result.data, null, 2));

  const loadResult = await loadFormularioResult(client, project.id, result);
  console.log("\n--- Resultado de la carga ---");
  console.log("companyId:", loadResult.companyId);
  console.log("personIds:", loadResult.personIds);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
