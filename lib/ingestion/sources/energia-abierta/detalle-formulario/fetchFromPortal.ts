/**
 * Descarga automática del documento "Formulario" desde Acceso Abierto —
 * endpoint real descubierto inspeccionando el tráfico de red del sitio (no
 * documentado públicamente, sin autenticación, CORS abierto):
 *
 *   GET /prod/data/public?tipo=11&anio=null&tipo_solicitud_id=null&solicitud_id={id}
 *     -> lista de documentos (nombre, ruta_s3, tipo_documento) de esa solicitud
 *   GET /prod/documentos/s3?app=aa&key={ruta_s3}&download={nombre}
 *     -> el archivo en sí
 *
 * `solicitud_id` es exactamente `project.external_reference` (verificado
 * contra un caso real: proyecto "SAND", external_reference="3076" == solicitud_id 3076).
 */

const API_BASE = "https://pkb3ax2pkg.execute-api.us-east-2.amazonaws.com/prod";

export interface AccesoAbiertoDocument {
  id: number;
  nombre: string;
  rutaS3: string;
  tipoDocumento: string;
  razonSocial: string | null;
  empresaId: string | null;
}

interface RawDocumentEntry {
  id: number;
  nombre: string;
  ruta_s3: string;
  tipo_documento: string;
  razon_social: string | null;
  empresa_id: string | null;
  deleted: number;
  visible: number;
}

export async function listDocumentsForSolicitud(solicitudId: string): Promise<AccesoAbiertoDocument[]> {
  const url = `${API_BASE}/data/public?tipo=11&anio=null&tipo_solicitud_id=null&solicitud_id=${encodeURIComponent(solicitudId)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Acceso Abierto (documentos) respondió ${res.status} ${res.statusText}`);
  const raw = (await res.json()) as RawDocumentEntry[];
  return raw
    .filter((d) => d.deleted === 0 && d.visible === 1)
    .map((d) => ({
      id: d.id,
      nombre: d.nombre,
      rutaS3: d.ruta_s3,
      tipoDocumento: d.tipo_documento,
      razonSocial: d.razon_social,
      empresaId: d.empresa_id,
    }));
}

/**
 * Descarga el contenido binario del documento (PDF o Excel) — dos pasos: el
 * endpoint `/documentos/s3` no devuelve el archivo, devuelve JSON con
 * `url_archivo` (una URL S3 firmada que expira en apenas 30 segundos, ver
 * `X-Amz-Expires=30` real observado), que hay que pedir de inmediato después.
 */
export async function downloadDocument(doc: AccesoAbiertoDocument): Promise<Buffer> {
  const signUrl = `${API_BASE}/documentos/s3?app=aa&key=${encodeURIComponent(doc.rutaS3)}&download=${encodeURIComponent(doc.nombre)}`;
  const signRes = await fetch(signUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!signRes.ok) throw new Error(`Acceso Abierto (firma S3) respondió ${signRes.status} ${signRes.statusText} para ${doc.nombre}`);
  const { url_archivo: fileUrl } = (await signRes.json()) as { url_archivo: string };
  if (!fileUrl) throw new Error(`Acceso Abierto no devolvió url_archivo para ${doc.nombre}`);

  const fileRes = await fetch(fileUrl, { signal: AbortSignal.timeout(30_000) });
  if (!fileRes.ok) throw new Error(`Descarga S3 respondió ${fileRes.status} ${fileRes.statusText} para ${doc.nombre}`);
  const arrayBuffer = await fileRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** El Formulario es el documento que trae contactos — filtra por tipo, ignora Carta Conductora y similares. */
export function findFormularioDocuments(docs: AccesoAbiertoDocument[]): AccesoAbiertoDocument[] {
  return docs.filter((d) => /formulario/i.test(d.tipoDocumento));
}
