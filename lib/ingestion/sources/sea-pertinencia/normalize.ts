import type { RawPertinenciaDetail } from "./fetchFromApi";

export interface NormalizedPertinencia {
  qidProcess: string;
  correlativeId: string;
  name: string;
  titularName: string | null;
  titularRut: string | null;
  region: string | null;
  comuna: string | null;
  estado: string | null;
  subEstado: string | null;
  requiereIngreso: string | null;
  fechaPresentacion: string | null;
  fechaRespuesta: string | null;
  tipologiaSeia: string | null;
  descripcion: string | null;
  documentos: Array<{ nombre: string; fecha: string; url: string }>;
}

/** Fechas del portal vienen "DD-MM-YYYY" — distinto del formato español largo de Acceso Abierto. */
function parseDdMmYyyy(input: string | null | undefined): string | null {
  if (!input) return null;
  const match = input.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

/** RUT viene como número plano sin puntos/guión, dígito verificador pegado al final (ej. 772482450 = 77.248.245-0). */
export function normalizeRut(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 2) return null;
  const body = digits.slice(0, -1);
  const dv = digits.slice(-1);
  return `${body}-${dv}`;
}

export function normalizePertinenciaDetail(raw: RawPertinenciaDetail): NormalizedPertinencia {
  const p = raw.pertinencia;
  return {
    qidProcess: p.qidProcess,
    correlativeId: p.correlativeId,
    name: p.name,
    titularName: p.titularName || null,
    titularRut: normalizeRut(p.titularRut),
    region: p.regiones?.[0]?.nombre ?? null,
    comuna: p.comunas?.[0]?.nombre ?? null,
    estado: p.state?.valor ?? null,
    // subEstado es string plano en la respuesta real, no {valor: ...} — confirmado empíricamente.
    subEstado: p.subEstado ?? null,
    requiereIngreso: p.requiereIngreso || null,
    fechaPresentacion: parseDdMmYyyy(p.presentationDate),
    fechaRespuesta: parseDdMmYyyy(p.dateResponse),
    tipologiaSeia: p.tipologies?.map((t) => t.nombreTipologia).join(", ") || null,
    descripcion: p.description || null,
    documentos: (raw.documentos ?? []).map((d) => ({ nombre: d.name, fecha: parseDdMmYyyy(d.documentDate) ?? d.documentDate, url: d.qidArchive })),
  };
}
