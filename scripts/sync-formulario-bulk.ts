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

/**
 * `--sin-rut` acota la corrida a los proyectos cuya empresa desarrolladora no
 * tiene RUT registrado.
 *
 * Por qué existe: el Formulario del Coordinador trae el RUT del titular y
 * `loadFormularioResult` lo escribe en la empresa cuando le falta. Medido el
 * 2026-08-18, 193 de las 245 empresas sin RUT no tienen el Formulario
 * procesado, así que procesar solo esos proyectos resuelve la identidad legal
 * de la mayoría sin bajar cientos de PDF que no aportan RUT nuevo.
 */
const SOLO_SIN_RUT = process.argv.includes("--sin-rut");
// El tamaño de lote es el primer argumento numérico: así puede ir antes o
// después de las banderas sin que `--sin-rut` se lea como el número.
const BATCH_SIZE = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? "20");
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

  /**
   * PostgREST corta en 1.000 filas aunque se pida más, y sin avisar. Con ~2.100
   * proyectos y ~1.400 registros de log, cualquier lectura de una sola pasada
   * viene incompleta: proyectos que nunca entran a la cola, y peor, proyectos
   * ya procesados que no aparecen en `doneIds` y se reprocesan. Todas las
   * lecturas masivas de este script pasan por acá.
   */
  async function leerTodo<T>(tabla: string, columnas: string, filtrar?: (q: never) => unknown): Promise<T[]> {
    const filas: T[] = [];
    for (let desde = 0; ; desde += 1000) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = client.from(tabla).select(columnas).range(desde, desde + 999);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (filtrar) q = (filtrar as any)(q);
      const { data, error } = await q;
      if (error) throw new Error(`Leyendo ${tabla}: ${error.message}`);
      filas.push(...((data ?? []) as T[]));
      if (!data || data.length < 1000) return filas;
    }
  }

  const alreadyLogged = await leerTodo<{ project_id: string }>("formulario_ingest_log", "project_id");
  const doneIds = new Set(alreadyLogged.map((r) => r.project_id));

  const REJECTED_STATUSES = ["Rechazada", "Desistida"];
  const startOfMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);

  // Los contactos de proyectos vigentes ("Esperados" — ver /proyectos-esperados)
  // valen más para desarrollo de negocio hoy que los de proyectos ya
  // rechazados/desistidos o vencidos — se procesan primero.
  type FilaProyecto = { id: string; name: string; external_reference: string; developer_company_id: string | null };
  const columnas = "id, name, external_reference, developer_company_id";
  const [esperados, resto] = await Promise.all([
    leerTodo<FilaProyecto>(
      "project",
      columnas,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((q: any) =>
        q
          .not("external_reference", "is", null)
          .not("status", "in", `(${REJECTED_STATUSES.join(",")})`)
          .gte("estimated_connection_date", startOfMonth)
          .order("estimated_connection_date", { ascending: true })) as never,
    ),
    leerTodo<FilaProyecto>(
      "project",
      columnas,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((q: any) =>
        q
          .not("external_reference", "is", null)
          .or(
            `status.in.(${REJECTED_STATUSES.join(",")}),estimated_connection_date.lt.${startOfMonth},estimated_connection_date.is.null`,
          )) as never,
    ),
  ]);

  const sinRut = new Set<string>();
  if (SOLO_SIN_RUT) {
    const empresas = await leerTodo<{ id: string }>(
      "company",
      "id",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((q: any) => q.is("rut", null)) as never,
    );
    for (const row of empresas) sinRut.add(row.id);
    console.log(`Filtro --sin-rut: ${sinRut.size} empresas sin RUT registrado.`);
  }

  const seen = new Set<string>();
  const ordered = [...esperados, ...resto].filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    if (SOLO_SIN_RUT && (!p.developer_company_id || !sinRut.has(p.developer_company_id))) return false;
    return true;
  });

  // El total pendiente se cuenta sobre la lista ya filtrada, no restando el
  // log completo: con --sin-rut el log incluye proyectos fuera del alcance y la
  // resta daba un número que no correspondía a lo que falta por procesar.
  const porProcesar = ordered.filter((p) => !doneIds.has(p.id as string));
  const pending = porProcesar.slice(0, BATCH_SIZE);
  console.log(`Proyectos sin procesar: ${porProcesar.length} — procesando ${pending.length} en esta corrida (esperados primero).`);

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
