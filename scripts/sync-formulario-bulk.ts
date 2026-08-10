import { config } from "dotenv";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile, unlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  listDocumentsForSolicitud,
  downloadDocument,
  findFormularioDocuments,
} from "../lib/ingestion/sources/energia-abierta/detalle-formulario/fetchFromPortal";
import { parseFormulario } from "../lib/ingestion/sources/energia-abierta/detalle-formulario";
import { loadFormularioResult } from "../lib/ingestion/sources/energia-abierta/detalle-formulario/load";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const BATCH_SIZE = Number(process.argv[2] ?? "20");
const DELAY_MS = 500; // no golpear el portal público sin pausas

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function logOutcome(
  client: SupabaseClient,
  projectId: string,
  solicitudId: string,
  status: string,
  documentId: number | null,
  errorMessage: string | null,
) {
  await client.from("formulario_ingest_log").upsert(
    {
      project_id: projectId,
      solicitud_id: solicitudId,
      document_id: documentId,
      status,
      error_message: errorMessage,
      processed_at: new Date().toISOString(),
    },
    { onConflict: "project_id" },
  );
}

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: alreadyLogged } = await client.from("formulario_ingest_log").select("project_id");
  const doneIds = new Set((alreadyLogged ?? []).map((r) => r.project_id as string));

  const REJECTED_STATUSES = ["Rechazada", "Desistida"];
  const startOfMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);

  // Los contactos de proyectos vigentes ("Esperados" — ver /proyectos-esperados)
  // valen más para desarrollo de negocio hoy que los de proyectos ya
  // rechazados/desistidos o vencidos — se procesan primero.
  const [{ data: esperados, error: e1 }, { data: resto, error: e2 }] = await Promise.all([
    client
      .from("project")
      .select("id, name, external_reference")
      .not("external_reference", "is", null)
      .not("status", "in", `(${REJECTED_STATUSES.join(",")})`)
      .gte("estimated_connection_date", startOfMonth)
      .order("estimated_connection_date", { ascending: true })
      .limit(3000),
    client
      .from("project")
      .select("id, name, external_reference")
      .not("external_reference", "is", null)
      .or(`status.in.(${REJECTED_STATUSES.join(",")}),estimated_connection_date.lt.${startOfMonth},estimated_connection_date.is.null`)
      .limit(3000),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);

  const seen = new Set<string>();
  const ordered = [...(esperados ?? []), ...(resto ?? [])].filter((p) => {
    if (seen.has(p.id as string)) return false;
    seen.add(p.id as string);
    return true;
  });

  const pending = ordered.filter((p) => !doneIds.has(p.id as string)).slice(0, BATCH_SIZE);
  console.log(`Proyectos sin procesar: ${ordered.length - doneIds.size} — procesando ${pending.length} en esta corrida (esperados primero).`);

  const tempDir = await mkdtemp(join(tmpdir(), "formulario-"));
  let success = 0;
  let noDocuments = 0;
  let noFormulario = 0;
  let errors = 0;

  for (const project of pending) {
    const solicitudId = project.external_reference as string;
    try {
      const docs = await listDocumentsForSolicitud(solicitudId);
      if (docs.length === 0) {
        await logOutcome(client, project.id as string, solicitudId, "no_documents", null, null);
        noDocuments++;
        await sleep(DELAY_MS);
        continue;
      }

      const formularios = findFormularioDocuments(docs); // .xlsx primero, luego más reciente
      if (formularios.length === 0) {
        await logOutcome(client, project.id as string, solicitudId, "no_formulario", null, null);
        noFormulario++;
        await sleep(DELAY_MS);
        continue;
      }

      const doc = formularios[0];
      const buffer = await downloadDocument(doc);
      const tempPath = join(tempDir, `${doc.id}${extname(doc.nombre) || ".pdf"}`);
      await writeFile(tempPath, buffer);

      try {
        const result = await parseFormulario(tempPath);
        await loadFormularioResult(client, project.id as string, result);
        await logOutcome(client, project.id as string, solicitudId, "success", doc.id, null);
        success++;
        console.log(`  [ok] ${project.name} (solicitud ${solicitudId}) — ${doc.nombre} (${result.kind})`);
      } finally {
        await unlink(tempPath).catch(() => {});
      }
    } catch (err) {
      errors++;
      const message = (err as Error).message;
      await logOutcome(client, project.id as string, solicitudId, "parse_error", null, message);
      console.log(`  [error] ${project.name} (solicitud ${solicitudId}): ${message}`);
    }
    await sleep(DELAY_MS);
  }

  console.log("\n--- Resumen ---");
  console.log("Procesados:", pending.length);
  console.log("Éxito:", success);
  console.log("Sin documentos:", noDocuments);
  console.log("Sin Formulario (solo otros docs):", noFormulario);
  console.log("Errores:", errors);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
