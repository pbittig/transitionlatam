/**
 * Las dos clases de marca de re-verificación, y quién las puede cerrar.
 *
 * Se marcan proyectos por dos motivos distintos que se resuelven distinto:
 *
 * - **Falta un dato** (hoy: se le quitó la sociedad vehículo porque era de
 *   plantilla). Se resuelve cuando el dato aparece. Verificar la ficha con el
 *   dato puesto ES resolverlo, así que la marca se cae sola.
 * - **El estado retrocedió** después de haber sido verificado. Verificar no lo
 *   resuelve: alguien tiene que mirar si el retroceso es real o un error de la
 *   fuente. Esa marca solo la quitan los botones de /admin/revision-dudosos.
 *
 * Sin esta distinción, todo lo que se validaba quedaba en la cola para siempre:
 * `markProjectVerified` tocaba `verified_at` y nada más, así que el 2026-08-17
 * el usuario encontró en la lista los mismos proyectos que acababa de validar.
 *
 * El motivo se distingue por su texto porque es lo que hay: la columna guarda
 * una frase, no un tipo. Vive acá y no copiado en cada lado para que el que
 * escribe la marca y el que la cierra no puedan desincronizarse.
 */
export const MOTIVO_SPV_FALTANTE = "Se le quitó la sociedad vehículo";

/** true si la marca se cierra sola al aparecer el dato que faltaba. */
export function esMarcaDeDatoFaltante(motivo: string | null | undefined): boolean {
  return !!motivo && motivo.startsWith(MOTIVO_SPV_FALTANTE);
}
