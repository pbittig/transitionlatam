/**
 * Cuándo un expediente SEIA vinculado a un proyecto puede presentarse como
 * antecedente ambiental del proyecto, y cuándo es sólo un candidato.
 *
 * El matcher automático (`match_method = 'nombre_normalizado_region'`) cruza por
 * nombre normalizado + región y se autoevalúa en alta/media/baja. Los de
 * confianza baja son, en la práctica, ruido: auditados el 2026-08-12 sobre los
 * 32 vinculados, aparecen expedientes de 1997-1999 de obras de transmisión
 * colgando de proyectos BESS y eólicos de 2026, y casos que matchearon por una
 * sola palabra del nombre ("Parque Eólico Ramal + BESS" en Calbuco vinculado al
 * "Ramal de distribución de gas al Observatorio ALMA" en San Pedro de Atacama,
 * a ~2.000 km). Ocho de esos 32 estaban sobre proyectos ya verificados: el
 * expediente equivocado pasó la revisión editorial junto con el resto de la
 * ficha.
 *
 * Un dato inventado cuesta más que un dato ausente: mostrar "Estado ambiental:
 * Aprobado" citando un expediente ajeno es peor que decir que no encontramos
 * expediente. Por eso el vínculo de confianza baja se conserva (sirve como pista
 * para el verificador y se sigue viendo en admin) pero no alimenta ningún estado
 * derivado ni se presenta como hecho en la ficha pública.
 *
 * El match manual (`match_method = 'manual'`) siempre es confiable: lo hizo una
 * persona en el verificador.
 */

export interface SeiaMatchTrustInput {
  matchConfidence: "alta" | "media" | "baja" | null;
}

/** true si el vínculo proyecto↔expediente puede tratarse como hecho. */
export function isConfirmedSeiaMatch(record: SeiaMatchTrustInput | null | undefined): boolean {
  if (!record) return false;
  return record.matchConfidence !== "baja";
}

/** El expediente existe pero el vínculo no está confirmado — se muestra como candidato, no como antecedente. */
export function isUnconfirmedSeiaMatch(record: SeiaMatchTrustInput | null | undefined): boolean {
  return !!record && !isConfirmedSeiaMatch(record);
}
