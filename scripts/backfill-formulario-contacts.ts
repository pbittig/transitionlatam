// Reprocesa proyectos ya cargados por sync-formulario-bulk.ts con la lógica vieja de
// parsePdf.ts, que mandaba al parser de regex (sin campo de correo) cualquier PDF que
// tuviera una sección de checklist, aunque el mismo documento trajera también la sección
// rica con correos reales — ver hallazgo real "BESS II San Andrés" y el fix en
// isVerificationChecklist/hasRichFormSection. Reprocesa los más antiguos primero (por
// processed_at), así corridas sucesivas van cubriendo todo sin necesidad de una columna
// extra de estado.
import { config } from "dotenv";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile, unlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createClient } from "@supabase/supabase-js";
import {
  listDocumentsForSolicitud,
  downloadDocument,
  findFormularioDocuments,
} from "../lib/ingestion/sources/energia-abierta/detalle-formulario/fetchFromPortal";
import { parseFormulario } from "../lib/ingestion/sources/energia-abierta/detalle-formulario";
import { loadFormularioResult } from "../lib/ingestion/sources/energia-abierta/detalle-formulario/load";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const BATCH_SIZE = Number(process.argv[2] ?? "30");
const DELAY_MS = 500; // no golpear el portal público sin pausas

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: logRows, error } = await client
    .from("formulario_ingest_log")
    .select("project_id, solicitud_id, processed_at")
    .eq("status", "success")
    .order("processed_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (error) throw new Error(error.message);
  if (!logRows?.length) {
    console.log("Nada para reprocesar.");
    return;
  }

  const { data: projects } = await client
    .from("project")
    .select("id, name")
    .in(
      "id",
      logRows.map((r) => r.project_id as string),
    );
  const projectNameById = new Map((projects ?? []).map((p) => [p.id as string, p.name as string]));

  const tempDir = await mkdtemp(join(tmpdir(), "formulario-backfill-"));
  let full = 0;
  let verificationOnly = 0;
  let noFormulario = 0;
  let errors = 0;

  for (const row of logRows) {
    const projectId = row.project_id as string;
    const solicitudId = row.solicitud_id as string;
    const projectName = projectNameById.get(projectId) ?? projectId;
    try {
      const docs = await listDocumentsForSolicitud(solicitudId);
      const formularios = findFormularioDocuments(docs).sort((a, b) => b.id - a.id); // más reciente primero
      if (formularios.length === 0) {
        noFormulario++;
        console.log(`  [sin formulario] ${projectName} (solicitud ${solicitudId})`);
        await sleep(DELAY_MS);
        continue;
      }

      const doc = formularios[0];
      const buffer = await downloadDocument(doc);
      const tempPath = join(tempDir, `${doc.id}${extname(doc.nombre) || ".pdf"}`);
      await writeFile(tempPath, buffer);

      try {
        const result = await parseFormulario(tempPath);
        await loadFormularioResult(client, projectId, result);
        await client
          .from("formulario_ingest_log")
          .update({ status: "success", document_id: doc.id, error_message: null, processed_at: new Date().toISOString() })
          .eq("project_id", projectId);

        if (result.kind === "full") {
          full++;
        } else {
          verificationOnly++;
        }
        console.log(`  [${result.kind}] ${projectName} (solicitud ${solicitudId}) — ${doc.nombre}`);
      } finally {
        await unlink(tempPath).catch(() => {});
      }
    } catch (err) {
      errors++;
      console.log(`  [error] ${projectName} (solicitud ${solicitudId}): ${(err as Error).message}`);
    }
    await sleep(DELAY_MS);
  }

  console.log("\n--- Resumen ---");
  console.log("Reprocesados:", logRows.length);
  console.log("Quedaron como 'full' (formulario rico, con IA):", full);
  console.log("Quedaron como 'verification_only' (checklist puro, sin correo posible):", verificationOnly);
  console.log("Sin documento Formulario esta vez:", noFormulario);
  console.log("Errores:", errors);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
