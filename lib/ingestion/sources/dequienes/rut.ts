/**
 * Conversión entre el RUT como lo guarda la base ("76.567.718-1") y como lo
 * exige la API de dequienes.cl: solo la parte numérica, sin dígito verificador,
 * puntos ni guión ("76567718").
 *
 * La API devuelve los nodos del grafo también en ese formato, así que al volver
 * hay que reconstruir el dígito verificador con módulo 11 para poder cruzar
 * contra company.rut. El cálculo es determinista — no es un dato inventado.
 */

/** Parte numérica que espera la API. Devuelve null si el RUT no es utilizable. */
export function rutParaApi(rut: string | null | undefined): string | null {
  if (!rut) return null;
  const limpio = rut.toUpperCase().replace(/[^0-9K]/g, "");
  if (limpio.length < 2) return null;
  const cuerpo = limpio.slice(0, -1);
  // Un cuerpo con K adentro no es un RUT: la K solo puede ser el verificador.
  if (!/^\d+$/.test(cuerpo)) return null;
  return String(Number(cuerpo));
}

/** Dígito verificador por módulo 11. */
export function digitoVerificador(cuerpo: string): string {
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i -= 1) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return String(resto);
}

/** "76567718" -> "76.567.718-1", para poder cruzar y mostrar. */
export function rutDesdeApi(numerico: string): string {
  const cuerpo = String(Number(numerico));
  const conPuntos = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${conPuntos}-${digitoVerificador(cuerpo)}`;
}

/** El RUT declarado coincide con su propio dígito verificador. */
export function rutEsValido(rut: string | null | undefined): boolean {
  if (!rut) return false;
  const limpio = rut.toUpperCase().replace(/[^0-9K]/g, "");
  if (limpio.length < 2) return false;
  const cuerpo = limpio.slice(0, -1);
  if (!/^\d+$/.test(cuerpo)) return false;
  return digitoVerificador(String(Number(cuerpo))) === limpio.slice(-1);
}

/**
 * Tipo de entidad según el tramo del RUT. Es una convención del SII, no un dato
 * que la API entregue: los RUT 59.xxx.xxx corresponden a inversionistas
 * extranjeros sin residencia, y bajo 50 millones son personas naturales.
 */
export function tipoEntidadPorRut(numerico: string): "company" | "person" | "foreign_company" {
  const n = Number(numerico);
  if (n >= 59_000_000 && n < 60_000_000) return "foreign_company";
  if (n < 50_000_000) return "person";
  return "company";
}
