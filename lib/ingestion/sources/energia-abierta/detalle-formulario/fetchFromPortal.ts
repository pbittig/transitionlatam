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
 * Pide la URL S3 firmada de un documento — expira en apenas 30 segundos (ver
 * `X-Amz-Expires=30` real observado), así que hay que usarla de inmediato
 * (descargarla server-side, o pasarla a un cliente que la abra al toque).
 */
export async function getSignedDocumentUrl(doc: AccesoAbiertoDocument): Promise<string> {
  const signUrl = `${API_BASE}/documentos/s3?app=aa&key=${encodeURIComponent(doc.rutaS3)}&download=${encodeURIComponent(doc.nombre)}`;
  const signRes = await fetch(signUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!signRes.ok) throw new Error(`Acceso Abierto (firma S3) respondió ${signRes.status} ${signRes.statusText} para ${doc.nombre}`);
  const { url_archivo: fileUrl } = (await signRes.json()) as { url_archivo: string };
  if (!fileUrl) throw new Error(`Acceso Abierto no devolvió url_archivo para ${doc.nombre}`);
  return fileUrl;
}

/** Descarga el contenido binario del documento (PDF o Excel) — usa la URL firmada de inmediato, antes de que expire. */
export async function downloadDocument(doc: AccesoAbiertoDocument): Promise<Buffer> {
  const fileUrl = await getSignedDocumentUrl(doc);
  const fileRes = await fetch(fileUrl, { signal: AbortSignal.timeout(30_000) });
  if (!fileRes.ok) throw new Error(`Descarga S3 respondió ${fileRes.status} ${fileRes.statusText} para ${doc.nombre}`);
  const arrayBuffer = await fileRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * El Formulario es el documento que trae contactos — filtra por tipo, ignora Carta
 * Conductora y similares. Ordenado con el .xlsx más útil primero: el Excel es
 * extracción determinística por celda, mientras que el PDF a veces es solo un
 * escaneo sin texto o el checklist de verificación mal detectado (casos reales
 * "BESS Río Llanco"/"BESS Charruana", 2026-08-09 — ambos con un .xlsx bueno
 * disponible para la misma solicitud, pero el pipeline elegía el .pdf de mayor id
 * y terminaba sin contactos). Dentro de la misma extensión, el id más alto (más
 * reciente) sigue ganando — todos los llamadores deben tomar el [0] del resultado
 * en vez de re-ordenar por id, o este orden se pierde.
 */
export function findFormularioDocuments(docs: AccesoAbiertoDocument[]): AccesoAbiertoDocument[] {
  return docs
    .filter((d) => /formulario/i.test(d.tipoDocumento))
    .sort((a, b) => {
      const aIsXlsx = /\.xlsx?$/i.test(a.nombre) ? 1 : 0;
      const bIsXlsx = /\.xlsx?$/i.test(b.nombre) ? 1 : 0;
      if (aIsXlsx !== bIsXlsx) return bIsXlsx - aIsXlsx;
      return b.id - a.id;
    });
}

/**
 * Informe de autorización de conexión — preliminar, definitivo, o el emitido
 * para proyectos "Fehaciente" (mismo tipo de documento, nombre distinto según
 * la etapa/tipo de solicitud; caso real "Ríos de Jerez" trae tanto el
 * preliminar como el definitivo como documentos separados). Es una fuente
 * secundaria: la pre-verificación lo consulta para horas de almacenamiento,
 * para resolver si una solicitud combina generación + BESS, y (agregado
 * 2026-08-09) para RUT/dirección legal cuando el Formulario no las trae — el
 * "definitivo" suele confirmar esos datos de forma más formal que el
 * "preliminar" original, antes solo se buscaba este último.
 *
 * En datos históricos el nombre puede aparecer con o sin "de Conexión" y con
 * pequeñas variaciones de acentos, por eso se exige la combinación distintiva
 * "Informe" + "Autorización" + (preliminar|definitivo|fehaciente) en tipo o
 * nombre del documento. Ordenar por id descendente ya prioriza el más
 * reciente cuando hay varios (el definitivo suele tener id mayor que el
 * preliminar de la misma solicitud, al emitirse después).
 */
export function findConnectionAuthorizationReports(
  docs: AccesoAbiertoDocument[],
): AccesoAbiertoDocument[] {
  return docs.filter((doc) => {
    const haystack = `${doc.tipoDocumento} ${doc.nombre}`;
    return /informe/i.test(haystack) && /autorizaci[oó]n/i.test(haystack) && /(preliminar|definitivo|fehaciente)/i.test(haystack);
  });
}
