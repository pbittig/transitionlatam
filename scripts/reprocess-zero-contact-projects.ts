// Reprocesa proyectos cuyo Formulario se ingirió con éxito (formulario_ingest_log
// status='success') pero terminaron sin ningún contacto vinculado — la gran
// mayoría son corridas viejas nunca reprocesadas desde los fixes de validación/
// selección de documento de esta sesión (ver commits 2026-08-09), no rechazos
// reales del código actual. reprocessFormularioContacts ya trae la lógica de
// descarga+parseo+carga en un solo paso, y ahora también se beneficia del fix
// que prefiere .xlsx sobre .pdf al elegir el Formulario (ver fetchFromPortal.ts).
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { reprocessFormularioContacts } from "../lib/ingestion/sources/energia-abierta/detalle-formulario/reprocess";

const DELAY_MS = 500; // mismo criterio que los demás scripts de backfill — no golpear el portal público sin pausas
const IN_BATCH_SIZE = 150; // límite de URL de PostgREST .in()

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: successRows, error: logError } = await client
    .from("formulario_ingest_log")
    .select("project_id")
    .eq("status", "success");
  if (logError) throw new Error(logError.message);
  const successIds = (successRows ?? []).map((r) => r.project_id as string);

  const contactedIds = new Set<string>();
  for (let i = 0; i < successIds.length; i += IN_BATCH_SIZE) {
    const batch = successIds.slice(i, i + IN_BATCH_SIZE);
    const { data, error } = await client
      .from("entity_relationship")
      .select("target_id")
      .eq("source_type", "person")
      .eq("target_type", "project")
      .in("target_id", batch);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) contactedIds.add(row.target_id as string);
  }

  const zeroContactIds = successIds.filter((id) => !contactedIds.has(id));
  console.log(`Proyectos con Formulario exitoso pero sin contactos: ${zeroContactIds.length} — reprocesando.`);

  let recovered = 0;
  let stillZero = 0;
  let errors = 0;
  let processed = 0;

  for (const projectId of zeroContactIds) {
    processed++;
    try {
      const result = await reprocessFormularioContacts(client, projectId);
      if (!result.success) {
        errors++;
        console.log(`  [${processed}/${zeroContactIds.length}] [error] ${projectId}: ${result.error}`);
      } else if ((result.contactCount ?? 0) > 0) {
        recovered++;
        console.log(`  [${processed}/${zeroContactIds.length}] [ok] ${projectId}: ${result.contactCount} contactos`);
      } else {
        stillZero++;
      }
    } catch (err) {
      errors++;
      console.log(`  [${processed}/${zeroContactIds.length}] [error] ${projectId}: ${(err as Error).message}`);
    }
    await sleep(DELAY_MS);
  }

  console.log("\n--- Resumen ---");
  console.log("Procesados:", zeroContactIds.length);
  console.log("Contactos recuperados:", recovered);
  console.log("Siguen en 0 (el Formulario realmente no trae contactos válidos):", stillZero);
  console.log("Errores:", errors);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
