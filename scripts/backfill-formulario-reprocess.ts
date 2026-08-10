// Reprocesa los proyectos con Formulario ya intentado que se benefician de los
// fixes de esta sesión (zip, hoja de Excel agnóstica a plantilla, contactos
// posicionales, campos de potencia, validación de RUT): los que fallaron
// (status='parse_error', ~175) y los que "tuvieron éxito" pero quedaron sin
// ningún campo de potencia/almacenamiento (status='success', ~747, bug de
// load.ts que nunca escribía esos campos). Orden: proyectos vigentes primero
// (no Rechazada/Desistida, conexión estimada futura), luego el resto.
// Reintento seguro: loadFormularioResult solo rellena campos en null, nunca
// pisa un valor ya cargado.
import { config } from "dotenv";
import { dirname, extname, join } from "node:path";
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

const DELAY_MS = 500; // no golpear el portal público sin pausas — mismo criterio que sync-formulario-bulk.ts
const IN_BATCH_SIZE = 150; // límite de URL de PostgREST .in()

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function selectInBatches<T>(client: SupabaseClient, table: string, columns: string, column: string, ids: string[]): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += IN_BATCH_SIZE) {
    const batch = ids.slice(i, i + IN_BATCH_SIZE);
    const { data, error } = await client.from(table).select(columns).in(column, batch);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
  }
  return out;
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
    { project_id: projectId, solicitud_id: solicitudId, document_id: documentId, status, error_message: errorMessage, processed_at: new Date().toISOString() },
    { onConflict: "project_id" },
  );
}

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: logRows, error: logError } = await client
    .from("formulario_ingest_log")
    .select("project_id, solicitud_id, status");
  if (logError) throw new Error(logError.message);

  const parseErrorRows = (logRows ?? []).filter((r) => r.status === "parse_error");
  const successRows = (logRows ?? []).filter((r) => r.status === "success");

  const successIds = successRows.map((r) => r.project_id as string);
  const successProjects = await selectInBatches<{
    id: string;
    net_injection_mw: number | null;
    net_withdrawal_mw: number | null;
    generation_capacity_mw: number | null;
    storage_capacity_mw: number | null;
    storage_hours: number | null;
    capacity_mwh: number | null;
  }>(
    client,
    "project",
    "id, net_injection_mw, net_withdrawal_mw, generation_capacity_mw, storage_capacity_mw, storage_hours, capacity_mwh",
    "id",
    successIds,
  );
  const allPowerNullIds = new Set(
    successProjects
      .filter(
        (p) =>
          p.net_injection_mw === null &&
          p.net_withdrawal_mw === null &&
          p.generation_capacity_mw === null &&
          p.storage_capacity_mw === null &&
          p.storage_hours === null &&
          p.capacity_mwh === null,
      )
      .map((p) => p.id),
  );

  const candidateIds = new Set([
    ...parseErrorRows.map((r) => r.project_id as string),
    ...successRows.filter((r) => allPowerNullIds.has(r.project_id as string)).map((r) => r.project_id as string),
  ]);
  const solicitudById = new Map<string, string>();
  for (const r of logRows ?? []) solicitudById.set(r.project_id as string, r.solicitud_id as string);

  const REJECTED_STATUSES = ["Rechazada", "Desistida"];
  const startOfMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10);

  const idList = Array.from(candidateIds);
  const projectsMeta = await selectInBatches<{ id: string; name: string; status: string; estimated_connection_date: string | null }>(
    client,
    "project",
    "id, name, status, estimated_connection_date",
    "id",
    idList,
  );
  const metaById = new Map(projectsMeta.map((p) => [p.id, p]));

  const vigentes: string[] = [];
  const historicos: string[] = [];
  for (const id of idList) {
    const meta = metaById.get(id);
    const isVigente =
      meta &&
      !REJECTED_STATUSES.includes(meta.status) &&
      meta.estimated_connection_date !== null &&
      meta.estimated_connection_date >= startOfMonth;
    (isVigente ? vigentes : historicos).push(id);
  }
  const ordered = [...vigentes, ...historicos];

  console.log(`Total candidatos a reprocesar: ${ordered.length} (${vigentes.length} vigentes, ${historicos.length} históricos)`);
  console.log(`  De parse_error: ${parseErrorRows.length}`);
  console.log(`  De success sin campos de potencia: ${allPowerNullIds.size}`);

  const tempDir = await mkdtemp(join(tmpdir(), "formulario-backfill-"));
  let success = 0;
  let stillError = 0;
  let noDocuments = 0;
  let noFormulario = 0;
  let processed = 0;

  for (const projectId of ordered) {
    processed++;
    const solicitudId = solicitudById.get(projectId)!;
    const name = metaById.get(projectId)?.name ?? projectId;
    try {
      const docs = await listDocumentsForSolicitud(solicitudId);
      if (docs.length === 0) {
        await logOutcome(client, projectId, solicitudId, "no_documents", null, null);
        noDocuments++;
        await sleep(DELAY_MS);
        continue;
      }
      const formularios = findFormularioDocuments(docs); // .xlsx primero, luego más reciente
      if (formularios.length === 0) {
        await logOutcome(client, projectId, solicitudId, "no_formulario", null, null);
        noFormulario++;
        await sleep(DELAY_MS);
        continue;
      }

      const doc = formularios[0];
      const buffer = await downloadDocument(doc);
      const tempPath = join(tempDir, `${doc.id}${extname(doc.nombre) || ".pdf"}`);
      try {
        await writeFile(tempPath, buffer);
        const result = await parseFormulario(tempPath);
        await loadFormularioResult(client, projectId, result);
        await logOutcome(client, projectId, solicitudId, "success", doc.id, null);
        success++;
        console.log(`  [${processed}/${ordered.length}] [ok] ${name} — ${doc.nombre} (${result.kind})`);
      } finally {
        await unlink(tempPath).catch(() => {});
      }
    } catch (err) {
      stillError++;
      const message = (err as Error).message;
      await logOutcome(client, projectId, solicitudId, "parse_error", null, message);
      console.log(`  [${processed}/${ordered.length}] [error] ${name}: ${message}`);
    }
    await sleep(DELAY_MS);
  }

  console.log("\n--- Resumen ---");
  console.log("Procesados:", ordered.length);
  console.log("Éxito:", success);
  console.log("Sin documentos:", noDocuments);
  console.log("Sin Formulario:", noFormulario);
  console.log("Con error persistente:", stillError);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
