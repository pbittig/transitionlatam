import { getSeiaMaturity, isSeiaNegativeTerminal } from "@/lib/shared/seiaStatusMaturity";

/**
 * Qué mostrar en "Estado ambiental" según la mejor evidencia disponible.
 *
 * La jerarquía, de más fuerte a más débil:
 *
 *   documental verificada  >  favorable sin expediente  >  inferida por avance
 *
 * El objetivo es no castigar a un proyecto que ya llegó a una etapa que
 * necesariamente exigió resolver su situación ambiental, solo porque todavía no
 * pudimos identificar su expediente en el SEIA. Pero la diferencia entre
 * "verificado" e "inferido" no se disuelve: se marca con un asterisco.
 *
 * Esto convive con la regla de no afirmar lo que la fuente no confirma
 * (docs/02-prd.md §2.3): la inferencia se muestra, se rotula como tal y se
 * explica en el tooltip. Lo que NO se hace es presentarla como una RCA
 * verificada documentalmente.
 */

export type EnvironmentalEvidence =
  /** 1 · RCA aprobada identificada y asociada al proyecto. */
  | "rcaAprobada"
  /** 2 · Hay expediente en el SEIA, todavía sin RCA aprobada. */
  | "expedienteSeia"
  /** 2b · Expediente cerrado sin aprobación (rechazado, desistido, no admitido). */
  | "expedienteTerminado"
  /** 3 · Antecedente favorable —típicamente una pertinencia que resuelve no ingresar— sin expediente SEIA. */
  | "favorableSinExpediente"
  /** 4 · Inferida: hay PGP/conexión real activa pero no identificamos el expediente. */
  | "inferidaPorAvance"
  /** 5 · Nada. */
  | "sinInformacion";

export interface EnvironmentalEvidenceInput {
  /** Estado del expediente SEIA, texto crudo de la fuente. */
  seiaStatus?: string | null;
  /** `true` si hay expediente vinculado aunque su estado no sea puntuable. */
  hasSeiaRecord?: boolean;
  /**
   * Sub-estado de la consulta de pertinencia ante el SEA. "Resuelta - No
   * ingreso al SEIA" es el caso favorable: el SEA resolvió que el proyecto no
   * requiere evaluación ambiental, así que no habrá expediente que encontrar.
   */
  pertinenciaSubEstado?: string | null;
  /** Avance físico de obra reportado en PGP. Su sola existencia es la señal. */
  pgpProgressPercent?: number | null;
}

export interface EnvironmentalEvidenceState {
  evidence: EnvironmentalEvidence;
  /** Null cuando no hay nada que mostrar: la celda va con guion. */
  percent: number | null;
  /** `true` → el porcentaje lleva asterisco y el tooltip lo explica. */
  inferred: boolean;
  /** Texto del estado, cuando existe uno que mostrar. */
  label: string | null;
}

/** El SEA resolvió que el proyecto no debe ingresar al SEIA: situación resuelta y favorable. */
const PERTINENCIA_FAVORABLE = "Resuelta - No ingreso al SEIA";

export const INFERENCIA_NOTA =
  "El proyecto cuenta con PGP/conexión real activa. Por lógica, el proceso ambiental es favorable, " +
  "pero aún no hemos podido identificar el expediente ambiental correspondiente en el SEIA.";

export function resolveEnvironmentalEvidence(input: EnvironmentalEvidenceInput): EnvironmentalEvidenceState {
  const { seiaStatus, pertinenciaSubEstado, pgpProgressPercent } = input;
  const hayExpediente = !!input.hasSeiaRecord || !!seiaStatus;

  if (seiaStatus && isSeiaNegativeTerminal(seiaStatus)) {
    // Un expediente cerrado sin aprobación no se maquilla ni se reemplaza por
    // una inferencia más favorable: la fuente dijo algo concreto y manda.
    return { evidence: "expedienteTerminado", percent: null, inferred: false, label: seiaStatus };
  }

  const madurez = getSeiaMaturity(seiaStatus ?? null);
  if (madurez?.band === "aprobado") {
    return { evidence: "rcaAprobada", percent: 100, inferred: false, label: seiaStatus ?? null };
  }
  if (hayExpediente) {
    return { evidence: "expedienteSeia", percent: madurez?.order ?? null, inferred: false, label: seiaStatus ?? null };
  }
  if (pertinenciaSubEstado === PERTINENCIA_FAVORABLE) {
    return {
      evidence: "favorableSinExpediente",
      percent: 100,
      inferred: false,
      label: "No requiere ingreso al SEIA",
    };
  }
  if (typeof pgpProgressPercent === "number" && pgpProgressPercent > 0) {
    return { evidence: "inferidaPorAvance", percent: 100, inferred: true, label: "Favorable por avance de obra" };
  }
  return { evidence: "sinInformacion", percent: null, inferred: false, label: null };
}
