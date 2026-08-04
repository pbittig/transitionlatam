/**
 * Descarga automática del listado completo de solicitudes desde Acceso Abierto
 * — mismo endpoint base que fetchFromPortal.ts (documentos), descubierto
 * inspeccionando el tráfico de red del botón "Descargar Todas" en la pestaña
 * "Estados Gráficos" del sitio. `tipo=6` trae el listado completo de
 * solicitudes en una sola llamada (2766 registros a la fecha de este
 * hallazgo), sin autenticación ni paginación.
 *
 * Validado contra 4 proyectos ya conocidos por el pipeline de Formulario
 * (Tilomonte, Espiga De Oro, Cabo Leones I, Degan): RUT, razón social,
 * comuna y región coinciden exactamente. Los campos de potencia
 * (potencia_nsi/nsr/cga/caa, energia_caa, horas_almacenamiento_caa) vienen
 * en null para muchos proyectos — el listado NO reemplaza al Formulario
 * para el desglose técnico fino, solo lo complementa con identidad/
 * ubicación/estado de forma más confiable y 100% automática.
 */

import type { NormalizedProject, RawSolicitudRow } from "./types";
import { normalizeTechnology, normalizeProjectKind, normalizeIncludesStorage, computeHeadlineCapacity, applyNameBasedStorageOverride } from "./normalize";

const API_BASE = "https://pkb3ax2pkg.execute-api.us-east-2.amazonaws.com/prod/data/public";

interface RawApiSolicitud {
  id: number;
  proyecto: string | null;
  nup: string | null;
  empresa_solicitante: string | null;
  razon_social: string | null;
  tipo_solicitud: string | null;
  estado_solicitud: string | null;
  create_date: string | null;
  tipo_proyecto_nombre: string | null;
  tipo_tecnologia_nombre: string | null;
  potencia_nsi: string | null;
  potencia_nsr: string | null;
  potencia_cga: string | null;
  potencia_caa: string | null;
  energia_caa: string | null;
  horas_almacenamiento_caa: string | null;
  fecha_estimada_conexion: string | null;
  nombre_se: string | null;
  nivel_tension: number | string | null;
  seccion_barra_conexion: string | null;
  pano_conexion: string | null;
  region: string | null;
  comuna: string | null;
  rut_empresa: string | null;
}

/**
 * Reintenta el fetch en sí (no solo el guardado) — caso real (2026-08-04):
 * este endpoint no pagina, es un solo request de ~2700 filas, y un corte de
 * red a mitad de la respuesta no siempre lanza un error de `fetch` (puede
 * devolver un JSON truncado pero igual parseable si el corte cae en un lugar
 * "conveniente" del array). No elimina el riesgo del todo — por eso además
 * existe la alerta de conteo en runSync.ts — pero baja la probabilidad real.
 */
export async function fetchSolicitudesFromApi(): Promise<RawApiSolicitud[]> {
  const url = `${API_BASE}?tipo=6&anio=null&tipo_solicitud_id=null&solicitud_id=null`;
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`Acceso Abierto (listado) respondió ${res.status} ${res.statusText}`);
      return (await res.json()) as RawApiSolicitud[];
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
  throw lastError ?? new Error("Acceso Abierto (listado): fetch falló sin detalle.");
}

function toNumber(value: string | number | null): number | null {
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

/** La API ya entrega fechas en ISO (a diferencia del Excel, que trae texto en español "17 de julio de 2026..." — ver parseSpanishDate en normalize.ts) — no pasa por ese parser. */
function toIsoOrNull(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Reconstruye un RawSolicitudRow solo para reutilizar computeHeadlineCapacity
 * (misma lógica de "capacidad titular" que ya usa el pipeline por Excel) —
 * el resto de NormalizedProject se arma directo desde los campos de la API,
 * sin pasar por normalizeRow (que asume fechas en español).
 */
export function normalizeApiRow(raw: RawApiSolicitud): NormalizedProject {
  const tipoTecnologia = raw.tipo_tecnologia_nombre;
  const projectName = raw.proyecto || `Solicitud ${raw.id}`;
  const baseTechnologyCode = normalizeTechnology(tipoTecnologia);
  const baseIncludesStorage = normalizeIncludesStorage(tipoTecnologia, baseTechnologyCode);
  const baseProjectKind = normalizeProjectKind(raw.tipo_proyecto_nombre);
  const { technologyCode, includesStorage, projectKind } = applyNameBasedStorageOverride(
    projectName,
    baseTechnologyCode,
    baseIncludesStorage,
    baseProjectKind,
  );

  const asRawRow: RawSolicitudRow = {
    id: raw.id,
    proyecto: raw.proyecto ?? "",
    nup: raw.nup,
    empresaSolicitante: raw.razon_social ?? raw.empresa_solicitante ?? "",
    tipo: raw.tipo_solicitud,
    estadoSolicitud: raw.estado_solicitud ?? "",
    fechaRecepcion: raw.create_date,
    capacidadMw: null,
    tipoProyecto: raw.tipo_proyecto_nombre,
    tipoTecnologia,
    potenciaNetaInyeccionMw: toNumber(raw.potencia_nsi),
    potenciaNetaRetiroMw: toNumber(raw.potencia_nsr),
    potenciaGeneracionMw: toNumber(raw.potencia_cga),
    potenciaAlmacenamientoMw: toNumber(raw.potencia_caa),
    energiaMwh: toNumber(raw.energia_caa),
    horasAlmacenamiento: toNumber(raw.horas_almacenamiento_caa),
    fechaEstimadaConexion: raw.fecha_estimada_conexion,
    puntoConexion: raw.nombre_se,
    nivelTension: raw.nivel_tension === null ? null : String(raw.nivel_tension),
    barra: raw.seccion_barra_conexion,
    pano: raw.pano_conexion,
    region: raw.region,
    comuna: raw.comuna,
    segmentoTransmision: null,
  };

  return {
    externalId: String(raw.id),
    projectName,
    nup: raw.nup,
    companyName: asRawRow.empresaSolicitante || "Sin identificar",
    requestType: raw.tipo_solicitud,
    statusLabel: raw.estado_solicitud || "Desconocido",
    technologyCode,
    includesStorage,
    projectKind,
    capacityMw: computeHeadlineCapacity(projectKind, asRawRow),
    capacityMwh: asRawRow.energiaMwh,
    netInjectionMw: asRawRow.potenciaNetaInyeccionMw,
    netWithdrawalMw: asRawRow.potenciaNetaRetiroMw,
    generationCapacityMw: asRawRow.potenciaGeneracionMw,
    storageCapacityMw: asRawRow.potenciaAlmacenamientoMw,
    storageHours: asRawRow.horasAlmacenamiento,
    estimatedConnectionDate: toIsoOrNull(raw.fecha_estimada_conexion)?.slice(0, 10) ?? null,
    receivedAt: toIsoOrNull(raw.create_date),
    connectionPoint: asRawRow.puntoConexion,
    voltageLevel: asRawRow.nivelTension,
    substationBay: asRawRow.pano,
    transmissionSegment: null,
    regionRaw: raw.region,
    comuna: raw.comuna,
  };
}

export type { RawApiSolicitud };
