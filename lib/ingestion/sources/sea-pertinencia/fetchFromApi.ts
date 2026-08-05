/**
 * API pública del portal de Consultas de Pertinencia del SEA — encontrada
 * inspeccionando el bundle JS del sitio (no está documentada oficialmente),
 * ver prueba técnica 2026-08-04/05. Sin autenticación, sin CAPTCHA. El
 * buscador no pagina ni filtra server-side (probado con varios nombres de
 * parámetro candidatos) — siempre devuelve el dataset completo (~26k filas,
 * ~20MB); el filtro real se hace en cliente (ver filter.ts).
 */
const BASE = "https://pertinencia.sea.gob.cl/api";
const HEADERS = { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } as const;

export interface RawPertinenciaListItem {
  qidProcess: string;
  name: string;
  presentationDate: string;
  dateResponse: string;
  correlativeId: string;
  titularName: string;
  projectType: { id: string; valor: string } | null;
  state: { id: string; valor: string } | null;
  subEstado: string | null;
  primaryTypologyName: string | null;
  regiones: Array<{ nombre: string; codigo: string }>;
  comunas: Array<{ nombre: string; codigo: string }>;
}

export interface RawPertinenciaDocumento {
  name: string;
  documentDate: string;
  qidArchive: string;
  qidDocument: string;
}

export interface RawPertinenciaDetail {
  pertinencia: {
    qidProcess: string;
    correlativeId: string;
    name: string;
    titularName: string;
    titularRut: string | number | null;
    description: string;
    presentationDate: string;
    dateResponse: string;
    state: { id: string; valor: string } | null;
    subEstado: string | null;
    requiereIngreso: string | null;
    regiones: Array<{ nombre: string }>;
    comunas: Array<{ nombre: string }>;
    tipologies: Array<{ nombreTipologia: string }>;
  };
  documentos: RawPertinenciaDocumento[];
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`${url} respondió ${res.status} ${res.statusText}`);
      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
  throw lastError ?? new Error(`${url}: fetch falló sin detalle.`);
}

export async function fetchPertinenciaListado(): Promise<RawPertinenciaListItem[]> {
  const res = await fetchWithRetry(`${BASE}/public/buscarCp`, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return (await res.json()) as RawPertinenciaListItem[];
}

/** qidProcess es el GUID interno (no el correlativeId "PERTI-2026-XXXX") — probado, ese último devuelve {}. */
export async function fetchPertinenciaDetalle(qidProcess: string): Promise<RawPertinenciaDetail> {
  const res = await fetchWithRetry(`${BASE}/public/expediente/getPertinenciaFull/${qidProcess}`, { headers: HEADERS });
  return (await res.json()) as RawPertinenciaDetail;
}
