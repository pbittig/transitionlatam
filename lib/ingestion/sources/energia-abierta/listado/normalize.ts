import type { NormalizedProject, RawSolicitudRow } from "./types";

// Tecnología "base" (sin considerar si además incluye almacenamiento — ver STORAGE_MODIFIER_MARKERS).
const TECHNOLOGY_MAP: Record<string, string> = {
  "híbrido": "hybrid", // combinación no especificada por la fuente
  "solar": "solar_pv",
  "consumo": "consumption",
  "eólico": "wind",
  "hidroeléctrica": "hydro",
  "térmica": "thermal",
  "almacenamiento": "bess",
  "baterías": "bess",
  "transmisión": "transmission",
  "solar con baterías": "solar_pv",
  "eólico con baterías": "wind",
  "bombeo hidroeléctrico": "pumped_hydro",
  "biomasa": "biomass",
  "geotérmica": "geothermal",
};

// "Tipo Tecnologia" que indican explícitamente almacenamiento como componente adicional
// (distinto de que el proyecto SEA almacenamiento puro, ej. "Almacenamiento"/"Baterías").
const STORAGE_MODIFIER_MARKERS = ["con baterías", "con bateria"];

// El Coordinador a menudo copia la clasificación de tecnología de la central
// generadora hermana a la solicitud de su BESS asociado (hallazgo real: "BESS
// Gran Teno" venía marcado "Solar" en la fuente, igual que su central hermana
// "PFV Gran Teno" — 378/398 proyectos vigentes con "BESS" en el nombre estaban
// mal clasificados). El nombre del proyecto es más confiable que ese campo
// para estos casos.
const NAME_STORAGE_MARKER = /\bbess\b|\bbateria(s)?\b|\balmacenamiento\b|\bsae\b/;
const NAME_STARTS_WITH_BESS = /^bess\b/;
const NAME_CRCA_MARKER = /\bcrca\b/;

/**
 * "BESS <sitio>" al inicio del nombre indica una solicitud de batería
 * independiente de su central hermana (no una central híbrida) — se
 * reclasifica como BESS puro (tecnología Y project_kind — sin
 * project_kind='storage' el cálculo del MW/MWh titular en
 * detalle-formulario/load.ts no sabe priorizar el componente de
 * almacenamiento, hallazgo real: 301 proyectos BESS quedaron con
 * project_kind null y su MWh nunca llegaba al campo titular). El resto de
 * los nombres con marcador de almacenamiento en otra posición ("PV+BESS
 * X", "X Solar-BESS") solo se marcan con includesStorage — pueden ser una
 * sola solicitud híbrida genuina y no hay la misma certeza para
 * reclasificar su tecnología base.
 */
export function applyNameBasedStorageOverride(
  projectName: string,
  technologyCode: string | null,
  includesStorage: boolean,
  projectKind: NormalizedProject["projectKind"],
): { technologyCode: string | null; includesStorage: boolean; projectKind: NormalizedProject["projectKind"] } {
  const normalizedName = normalizeForMatch(projectName);
  // CRCA = Central Renovable con Almacenamiento. Es una iniciativa híbrida
  // dentro del alcance prioritario aunque la fuente omita la tecnología base.
  if (NAME_CRCA_MARKER.test(normalizedName)) {
    return { technologyCode: technologyCode ?? "hybrid", includesStorage: true, projectKind: "hybrid" };
  }
  if (!NAME_STORAGE_MARKER.test(normalizedName)) return { technologyCode, includesStorage, projectKind };
  if (NAME_STARTS_WITH_BESS.test(normalizedName)) {
    return { technologyCode: "bess", includesStorage: true, projectKind: "storage" };
  }
  return { technologyCode, includesStorage: true, projectKind };
}

const PROJECT_KIND_MAP: Record<string, NormalizedProject["projectKind"]> = {
  "generación": "generation",
  "consumo": "consumption",
  "sistema de almacenamiento de energía (sae)": "storage",
  "central renovable con capacidad de almacenamiento (crca)": "hybrid",
  "transmisión": "transmission",
  "almacenamiento para crca": "storage",
  "central renovable por bombeo": "hybrid",
};

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

const APOSTROPHE_LIKE = /['''`´]/g;

/**
 * Lowercase, strip accents/diacritics and non-alphanumeric chars, for fuzzy
 * matching. Apostrophes are dropped without introducing a word break (so
 * "O'Higgins" and "OHiggins" — as seen in real source data — match), while
 * other punctuation still separates words.
 */
export function normalizeForMatch(input: string): string {
  return input
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .replace(APOSTROPHE_LIKE, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Parses "17 de julio de 2026 19:09:22.775" style Spanish long-form datetimes. */
export function parseSpanishDate(input: string | null): string | null {
  if (!input) return null;
  const match = input.match(
    /^(\d{1,2}) de (\p{L}+) de (\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?/u,
  );
  if (!match) return null;

  const [, day, monthName, year, hour, minute, second] = match;
  const month = MONTHS[normalizeForMatch(monthName)];
  if (!month) return null;

  const iso = new Date(
    Date.UTC(
      Number(year),
      month - 1,
      Number(day),
      hour ? Number(hour) : 0,
      minute ? Number(minute) : 0,
      second ? Number(second) : 0,
    ),
  );
  return iso.toISOString();
}

export function normalizeTechnology(raw: string | null): string | null {
  if (!raw) return null;
  return TECHNOLOGY_MAP[normalizeForMatch(raw)] ?? null;
}

export function normalizeProjectKind(raw: string | null): NormalizedProject["projectKind"] {
  if (!raw) return null;
  return PROJECT_KIND_MAP[normalizeForMatch(raw)] ?? null;
}

/**
 * true si la tecnología base viene acompañada de almacenamiento (ej. "Solar con
 * Baterías"), o si el proyecto ya es puramente de almacenamiento. No requiere IA:
 * "Tipo Tecnologia" ya trae esta distinción como texto categórico de la fuente.
 */
export function normalizeIncludesStorage(rawTechnology: string | null, technologyCode: string | null): boolean {
  if (technologyCode === "bess") return true;
  if (!rawTechnology) return false;
  const normalized = normalizeForMatch(rawTechnology);
  return STORAGE_MODIFIER_MARKERS.some((marker) => normalized.includes(normalizeForMatch(marker)));
}

/**
 * "Capacidad [MW]" del archivo original no distingue consumo de generación de
 * almacenamiento — se calcula un valor "titular" según project_kind, pero las
 * columnas net_injection_mw, generation_capacity_mw y storage_capacity_mw del
 * proyecto conservan el desglose completo. Ver /docs/04-modelo-datos.md §4.8.
 */
export function computeHeadlineCapacity(
  projectKind: NormalizedProject["projectKind"],
  raw: RawSolicitudRow,
): number | null {
  switch (projectKind) {
    case "consumption":
      return raw.potenciaNetaRetiroMw ?? raw.capacidadMw;
    case "storage":
      return raw.potenciaAlmacenamientoMw ?? raw.capacidadMw;
    case "transmission":
      return null;
    case "generation":
    case "hybrid":
    default:
      return raw.potenciaNetaInyeccionMw ?? raw.potenciaGeneracionMw ?? raw.capacidadMw;
  }
}

export function normalizeRow(raw: RawSolicitudRow): NormalizedProject {
  const projectName = raw.proyecto || `Solicitud ${raw.id}`;
  const baseProjectKind = normalizeProjectKind(raw.tipoProyecto);
  const baseTechnologyCode = normalizeTechnology(raw.tipoTecnologia);
  const baseIncludesStorage = normalizeIncludesStorage(raw.tipoTecnologia, baseTechnologyCode);
  const { technologyCode, includesStorage, projectKind } = applyNameBasedStorageOverride(
    projectName,
    baseTechnologyCode,
    baseIncludesStorage,
    baseProjectKind,
  );

  return {
    externalId: String(raw.id),
    projectName,
    nup: raw.nup,
    companyName: raw.empresaSolicitante || "Sin identificar",
    requestType: raw.tipo,
    statusLabel: raw.estadoSolicitud || "Desconocido",
    technologyCode,
    includesStorage,
    projectKind,
    capacityMw: computeHeadlineCapacity(projectKind, raw),
    capacityMwh: raw.energiaMwh,
    netInjectionMw: raw.potenciaNetaInyeccionMw,
    netWithdrawalMw: raw.potenciaNetaRetiroMw,
    generationCapacityMw: raw.potenciaGeneracionMw,
    storageCapacityMw: raw.potenciaAlmacenamientoMw,
    storageHours: raw.horasAlmacenamiento,
    estimatedConnectionDate: parseSpanishDate(raw.fechaEstimadaConexion)?.slice(0, 10) ?? null,
    receivedAt: parseSpanishDate(raw.fechaRecepcion),
    connectionPoint: raw.puntoConexion,
    voltageLevel: raw.nivelTension,
    substationBay: raw.pano,
    transmissionSegment: raw.segmentoTransmision,
    regionRaw: raw.region,
    comuna: raw.comuna,
  };
}
