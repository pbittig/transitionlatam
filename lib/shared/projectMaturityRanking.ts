import { getStatusMaturity } from "@/lib/shared/projectStatusMaturity";
import { getSeiaMaturity } from "@/lib/shared/seiaStatusMaturity";

/**
 * Orden por defecto de la tabla de proyectos: primero los que tienen evidencia
 * real de ejecución, no los que tienen la fecha más cercana.
 *
 * POR QUÉ NO ALCANZA ORDENAR POR FECHA. La fecha de conexión la declara el
 * titular y contra su propia estimación en PGP la desviación promedio es de
 * +750 días (ver la skill de dominio y VIGENCIA_GRACE_DAYS). Una fecha próxima
 * no es evidencia de nada; un 87% de obra reportado en PGP sí lo es. Ordenar por
 * fecha ponía arriba proyectos que quizá nunca se construyan y enterraba los que
 * ya tienen obra.
 *
 * LA JERARQUÍA, de mayor a menor evidencia:
 *
 *   obra en PGP  >  proceso ambiental  >  avance de conexión
 *
 * La fecha NO es un nivel: es el último desempate dentro del nivel que
 * corresponda. Un proyecto no sube de categoría por tener la fecha cerca, que es
 * justamente el problema que este orden viene a resolver.
 *
 *   3 · PGP identificado      hay avance físico de obra reportado oficialmente
 *   2 · Proceso ambiental     hay expediente SEIA, ordenado por su madurez
 *   1 · Avance de conexión    sin lo anterior; incluye a los que ni siquiera
 *                             tienen estado de conexión legible, que entran con
 *                             avance 0 y quedan al fondo
 *
 * Dentro de cada nivel se desempata con las señales secundarias que el nivel
 * tenga, y recién al final con la proximidad de la fecha.
 *
 * ESTO ES PRESENTACIÓN, NO DATO. No altera ni deriva nada que se guarde: es una
 * función del listado, y el score no se muestra al usuario.
 */

/**
 * Tramos de evidencia. El número es el peso: más alto sale antes.
 *
 * No hay tramo "solo fecha" a propósito: la fecha nunca define el nivel, solo
 * desempata dentro de él. Lo que antes caía ahí —proyectos sin estado de
 * conexión legible— entra en `avanceConexion` con avance 0, que los deja igual
 * al fondo pero sin sugerir que la fecha sea una categoría de madurez.
 */
export const MATURITY_TIER = {
  avanceConexion: 1,
  procesoAmbiental: 2,
  obraEnPgp: 3,
} as const;

export interface ProjectMaturitySignals {
  /** Avance físico de obra reportado en el PGP del Coordinador (0-100). Null si el proyecto no está en PGP. */
  pgpProgressPercent?: number | null;
  /** Fecha de entrada en operación estimada según el expediente PGP. */
  pgpOperativeEstimateDate?: string | null;
  /** Estado del trámite de conexión, tal como lo publica el Coordinador. */
  connectionStatus?: string | null;
  /** Estado del expediente ambiental. Null cuando no hay expediente vinculado. */
  seiaStatus?: string | null;
  /** `true` si hay expediente ambiental aunque su estado no se pueda puntuar. */
  hasSeiaRecord?: boolean;
  /** Fecha de conexión declarada por el titular. */
  estimatedConnectionDate?: string | null;
}

/**
 * El score se arma por posiciones, no sumando pesos sueltos: cada señal ocupa su
 * propio rango y no puede invadir el de la anterior. Así "mayor avance de obra"
 * nunca lo revierte una fecha más cercana, que es justamente lo que se pedía
 * evitar.
 *
 *   nivel · 1e9  +  principal · 1e6  +  secundaria · 1e3  +  desempate
 *
 * Cada componente va acotado a 0..999, así que el máximo (~4.999e9) entra sin
 * problemas en un double.
 */
const ESCALA = 999;

function acotar(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  return Math.max(0, Math.min(ESCALA, Math.round(valor)));
}

/** Un porcentaje 0-100 llevado a la escala interna. */
function desdePorcentaje(pct: number | null | undefined): number {
  if (pct === null || pct === undefined) return 0;
  return acotar((pct / 100) * ESCALA);
}

/**
 * Proximidad de una fecha: más cerca, más alto. Solo se usa como último
 * desempate.
 *
 * El horizonte son 10 años porque el pipeline chileno tiene solicitudes con
 * conexión declarada más allá de 2035; con una ventana más corta todas ellas
 * empatarían en cero y el desempate dejaría de ordenar.
 */
const HORIZONTE_DIAS = 3650;

function proximidad(fecha: string | null | undefined, hoy: Date): number {
  if (!fecha) return 0;
  const [year, month, day] = fecha.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return 0;
  // Se compara en UTC contra una fecha sin hora: son días del calendario, no
  // instantes (mismo criterio que formatDateOnly).
  const objetivo = Date.UTC(year, month - 1, day);
  const referencia = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  const dias = (objetivo - referencia) / 86_400_000;
  // Una fecha ya pasada es lo más inminente que hay: no se penaliza.
  if (dias <= 0) return ESCALA;
  return acotar(ESCALA * (1 - Math.min(dias, HORIZONTE_DIAS) / HORIZONTE_DIAS));
}

export interface MaturityBreakdown {
  tier: number;
  principal: number;
  secundaria: number;
  desempate: number;
  score: number;
}

/**
 * Devuelve el desglose además del score. Sirve para explicar un orden que a
 * simple vista puede parecer arbitrario, y para poder probarlo por partes.
 */
export function calculateProjectMaturityBreakdown(
  signals: ProjectMaturitySignals,
  hoy: Date = new Date(),
): MaturityBreakdown {
  const conexion = getStatusMaturity(signals.connectionStatus ?? null);
  const avanceConexion = desdePorcentaje(conexion?.order ?? null);

  let tier: number;
  let principal: number;
  let secundaria: number;
  let desempate: number;

  const tieneObra = typeof signals.pgpProgressPercent === "number" && signals.pgpProgressPercent > 0;
  const ambiental = getSeiaMaturity(signals.seiaStatus ?? null);
  const tieneAmbiental = !!ambiental || !!signals.hasSeiaRecord || !!signals.seiaStatus;

  if (tieneObra) {
    // Manda el avance de obra; el avance de conexión desempata; la fecha del
    // PGP solo si las dos anteriores empatan.
    tier = MATURITY_TIER.obraEnPgp;
    principal = desdePorcentaje(signals.pgpProgressPercent);
    secundaria = avanceConexion;
    desempate = proximidad(signals.pgpOperativeEstimateDate ?? signals.estimatedConnectionDate, hoy);
  } else if (tieneAmbiental) {
    // La madurez del expediente ambiental. Un expediente identificado sin estado
    // puntuable entra igual, con principal 0: existir ya es señal.
    tier = MATURITY_TIER.procesoAmbiental;
    principal = desdePorcentaje(ambiental?.order ?? null);
    secundaria = avanceConexion;
    desempate = proximidad(signals.estimatedConnectionDate, hoy);
  } else {
    // Sin obra ni expediente. `conexion` puede ser null —estado ausente o que la
    // escala no reconoce— y entonces el avance es 0: quedan al fondo, ordenados
    // entre sí por cercanía de la fecha.
    tier = MATURITY_TIER.avanceConexion;
    principal = avanceConexion;
    secundaria = 0;
    desempate = proximidad(signals.estimatedConnectionDate, hoy);
  }

  const score = tier * 1_000_000_000 + acotar(principal) * 1_000_000 + acotar(secundaria) * 1_000 + acotar(desempate);
  return { tier, principal: acotar(principal), secundaria: acotar(secundaria), desempate: acotar(desempate), score };
}

/** El score a secas, para ordenar de mayor a menor. */
export function calculateProjectMaturityScore(signals: ProjectMaturitySignals, hoy: Date = new Date()): number {
  return calculateProjectMaturityBreakdown(signals, hoy).score;
}

/**
 * Comparador listo para `Array.prototype.sort`: score descendente y, a igualdad
 * exacta, nombre — sin eso el orden de dos proyectos idénticos cambiaría entre
 * recargas y la tabla parecería inestable.
 */
export function compareByMaturity(
  a: { maturityScore: number; name: string },
  b: { maturityScore: number; name: string },
): number {
  return b.maturityScore - a.maturityScore || a.name.localeCompare(b.name, "es");
}
