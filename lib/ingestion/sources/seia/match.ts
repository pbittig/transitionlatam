import { normalizeForMatch } from "../energia-abierta/listado/normalize";
import { searchSeiaByName } from "./searchApi";
import type { RawSeiaProject } from "./types";

// Palabras genéricas de la industria — coincidir solo en estas produciría falsos
// positivos (dos proyectos solares no relacionados ambos contienen "solar").
// El match exige al menos una palabra distintiva (el "nombre propio" del sitio)
// en común, no solo términos de tecnología/tipo de instalación.
const STOPWORDS = new Set(
  [
    "pfv", "pmgd", "pe", "ph", "hp", "bess", "ter", "ar", "psf", "pf",
    "parque", "central", "proyecto", "planta", "solar", "eolico", "fotovoltaico",
    "hidroelectrica", "hidroelectrico", "termoelectrica", "geotermica", "ampliacion",
    "etapa", "fase", "sistema", "almacenamiento", "sae", "bateria", "baterias",
    "energia", "generacion", "nueva", "nuevo", "de", "del", "la", "el", "los", "las", "y",
  ].map(normalizeForMatch),
);

export function distinctiveTokens(name: string): string[] {
  return normalizeForMatch(name)
    .split(" ")
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

// Formas legales y palabras genéricas de razón social — se quitan para comparar
// el titular SEIA contra nuestra empresa desarrolladora sin que "SpA"/"S.A." o
// "Chile" hagan fallar una comparación por lo demás idéntica.
const COMPANY_STOPWORDS = new Set(
  ["spa", "s a", "sa", "ltda", "limitada", "chile", "de", "del", "la", "el", "los", "las", "y"].map(normalizeForMatch),
);

function companyTokens(name: string): Set<string> {
  return new Set(
    normalizeForMatch(name)
      .split(" ")
      .filter((t) => t.length > 1 && !COMPANY_STOPWORDS.has(t)),
  );
}

/**
 * ¿El titular SEIA es (probablemente) la misma empresa que nuestro desarrollador?
 * Comparación por superposición de tokens distintivos, no RUT — SEIA no expone
 * RUT en la búsqueda pública, solo el nombre del titular. Exige que al menos la
 * mitad de nuestros tokens distintivos aparezcan en el titular SEIA; tolera
 * diferencias de forma legal/orden de palabras sin exigir el string exacto.
 */
function titularLikelyMatches(ourCompanyName: string | null, seiaTitular: string | null): boolean {
  if (!ourCompanyName || !seiaTitular) return false;
  const ours = companyTokens(ourCompanyName);
  const theirs = companyTokens(seiaTitular);
  if (ours.size === 0 || theirs.size === 0) return false;
  let intersection = 0;
  for (const t of ours) if (theirs.has(t)) intersection++;
  return intersection / ours.size >= 0.5;
}

// SEIA antepone "Región de "/"Región del "/"Región Metropolitana de " — se
// quita para comparar contra nuestros nombres de región ("Antofagasta", etc.).
function normalizeRegionName(region: string): string {
  return normalizeForMatch(region.replace(/^regi[oó]n\s+(de\s+|del\s+)?/i, "").replace(/^metropolitana\s+de\s+/i, ""));
}

// Todo proyecto que rastreamos es una central (generación, almacenamiento o
// híbrido) — nunca una línea de transmisión ni una subestación por sí solas.
// SEIA sí clasifica proyectos híbridos generación+almacenamiento bajo "c"
// (ver "Parque Fotovoltaico, de almacenamiento y línea de Transmisión Copao"),
// así que "c" sigue siendo el tipo correcto sin importar si hay almacenamiento.
// Un expediente de línea de transmisión (b1) o subestación (b2) puede compartir
// nombre con nuestra central (el proyecto suele presentar ambos procesos juntos:
// "Línea de Transmisión y Central BESS Halcón 8") sin ser el expediente de la
// central en sí — hallazgo real: varios proyectos BESS quedaron matcheados con
// su línea de transmisión en vez de su central.
const GENERATION_TYPE_CODE = "c";

export interface SeiaMatchCandidate {
  record: RawSeiaProject;
  coverage: number; // 0-1: cuántas palabras distintivas de nuestro proyecto aparecen en el nombre SEIA
  regionMatches: boolean;
  isGenerationType: boolean;
  titularMatches: boolean;
}

export interface SeiaMatchResult {
  candidate: RawSeiaProject;
  confidence: "alta" | "media" | "baja";
}

/**
 * Busca en SEIA candidatos para un proyecto del pipeline y devuelve el mejor
 * match con su nivel de confianza — o null si nada supera el umbral mínimo.
 * Nunca "alta" sin coincidencia de región: mismo nombre distintivo en regiones
 * distintas es demasiado común (parques con nombres genéricos de sitio) para
 * confiar sin ese refuerzo.
 */
export async function findBestSeiaMatch(
  projectName: string,
  projectRegion: string | null,
  developerCompanyName: string | null = null,
): Promise<SeiaMatchResult | null> {
  const ourTokens = distinctiveTokens(projectName);
  if (ourTokens.length === 0) return null;

  // La búsqueda ya viene acotada al sector económico "Energía" (searchSeiaByName),
  // así que no hace falta filtrar por código de tipología acá.
  const searchTerm = ourTokens.join(" ");
  const response = await searchSeiaByName(searchTerm, 20);
  if (response.data.length === 0) return null;

  const ourRegionNormalized = projectRegion ? normalizeForMatch(projectRegion) : null;

  const candidates: SeiaMatchCandidate[] = response.data.map((record) => {
    const seiaTokens = new Set(normalizeForMatch(record.EXPEDIENTE_NOMBRE).split(" "));
    const hits = ourTokens.filter((t) => seiaTokens.has(t)).length;
    const coverage = hits / ourTokens.length;
    const regionMatches = ourRegionNormalized !== null && normalizeRegionName(record.REGION_NOMBRE) === ourRegionNormalized;
    const isGenerationType = record.TIPO_PROYECTO === GENERATION_TYPE_CODE;
    const titularMatches = titularLikelyMatches(developerCompanyName, record.TITULAR);
    return { record, coverage, regionMatches, isGenerationType, titularMatches };
  });

  // Un mismo proyecto puede tener varios expedientes SEIA (reingreso tras
  // rechazo, actualizaciones, o procesos hermanos como la línea de conexión) —
  // entre candidatos que superan el umbral de cobertura, se prefiere primero
  // el expediente de central (isGenerationType), luego uno cuyo titular
  // coincida con nuestra empresa desarrolladora (hallazgo real, piloto Kimi/GLM
  // 2026-07-26: "BESS Llanos del Viento" matcheaba en "alta" confianza con
  // "Parque Eólico Llanos del Viento", mismo nombre de sitio, empresa
  // completamente distinta — SEIA no expone tecnología en la búsqueda, así que
  // el titular es la única señal real para separar estos casos), luego
  // cobertura, luego región, luego el más reciente por fecha de presentación.
  candidates.sort((a, b) => {
    const aQualifies = a.coverage >= 0.5;
    const bQualifies = b.coverage >= 0.5;
    if (aQualifies !== bQualifies) return aQualifies ? -1 : 1;
    return (
      (b.isGenerationType ? 1 : 0) - (a.isGenerationType ? 1 : 0) ||
      (b.titularMatches ? 1 : 0) - (a.titularMatches ? 1 : 0) ||
      b.coverage - a.coverage ||
      (b.regionMatches ? 1 : 0) - (a.regionMatches ? 1 : 0) ||
      Number(b.record.FECHA_PRESENTACION || 0) - Number(a.record.FECHA_PRESENTACION || 0)
    );
  });
  const best = candidates[0];
  if (!best || best.coverage < 0.5) return null;

  // Si conocemos el nombre de nuestra empresa desarrolladora y el titular SEIA
  // del mejor candidato NO coincide, es una señal fuerte de que compartimos
  // nombre de sitio pero no somos el mismo proyecto — nunca confiar "alta"/
  // "media" en ese caso, exactamente el patrón del caso real citado arriba.
  const titularMismatch = developerCompanyName !== null && !best.titularMatches;

  // Una sola palabra distintiva en común (ej. solo el nombre del lugar, "Panimávida")
  // no es suficiente para "alta" aunque coincida 100% + región — muchos proyectos
  // no relacionados comparten un topónimo (caso real detectado: coincidió con una
  // planta industrial sin ninguna relación, no un proyecto energético). Con 2+
  // palabras distintivas en común el riesgo de coincidencia casual baja mucho.
  const strongEnoughForAlta = ourTokens.length >= 2;
  // Un expediente que no es de central generadora (línea de transmisión,
  // subestación) puede ser el único resultado que comparte nombre con nuestro
  // proyecto sin ser su expediente ambiental real — se guarda igual (útil para
  // revisión manual en la ficha) pero nunca con confianza alta/media.
  const confidence: "alta" | "media" | "baja" = !best.isGenerationType || titularMismatch
    ? "baja"
    : best.coverage >= 0.99 && best.regionMatches && strongEnoughForAlta
      ? "alta"
      : best.coverage >= 0.7 || best.regionMatches
        ? "media"
        : "baja";

  return { candidate: best.record, confidence };
}
