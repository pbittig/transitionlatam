// Reprocesa contactos de proyectos NO verificados todavía (con Formulario ya
// cargado), con la lógica de extracción mejorada — para que cuando lleguen a
// verificarse, markProjectVerified (que también reprocesa) encuentre todo
// fresco y no dependa de la extracción en vivo. Pedido puntual, no es parte
// del pipeline regular.
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { reprocessFormularioContacts } from "../lib/ingestion/sources/energia-abierta/detalle-formulario/reprocess";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const DELAY_MS = 600;
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  let rows: Array<{ project_id: string; processed_at: string; project: { name: string; verified_at: string | null } }> = [];
  let from = 0;
  while (true) {
    const { data, error } = await client
      .from("formulario_ingest_log")
      .select("project_id, processed_at, project:project_id!inner(name, verified_at)")
      .eq("status", "success")
      .is("project.verified_at", null)
      .order("processed_at", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows = rows.concat(data as unknown as typeof rows);
    if (data.length < 1000) break;
    from += 1000;
  }

  console.log(`Proyectos NO verificados a reprocesar: ${rows.length}`);

  let ok = 0, errors = 0, sinFormulario = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const projectId = row.project_id;
    const projectName = row.project?.name ?? projectId;
    try {
      const result = await reprocessFormularioContacts(client, projectId);
      if (result.success) {
        if (result.contactCount === 0) sinFormulario++;
        ok++;
        if ((i + 1) % 25 === 0) console.log(`  [${i + 1}/${rows.length}] ok=${ok} err=${errors} — último: ${projectName} (${result.contactCount} contactos)`);
      } else {
        errors++;
        console.log(`  [error] ${projectName}: ${result.error}`);
      }
    } catch (err) {
      errors++;
      console.log(`  [error] ${projectName}: ${(err as Error).message}`);
    }
    await sleep(DELAY_MS);
  }

  console.log("\n--- Resumen ---");
  console.log("Total:", rows.length, "ok:", ok, "sin contactos:", sinFormulario, "errores:", errors);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
