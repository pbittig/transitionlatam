/**
 * Nombre de tecnología para mostrar en pantalla.
 *
 * La tabla `technology` guarda el nombre largo de la fuente. Casi todos ya son
 * cortos ("Solar", "Eólico", "Térmica"), pero el de almacenamiento —
 * "Almacenamiento (Baterías)"— no cabe en una celda de tabla sin robarle ancho
 * a las columnas que traen el dato duro. En pantalla se usa la sigla que el
 * resto del sitio ya usa para lo mismo: el chip de tecnología, el filtro y la
 * ficha de proyecto dicen "BESS" (ver TECH_CHIPS en components/techChips.ts).
 *
 * El nombre de la fuente NO se toca en la base: esto es solo presentación, y
 * cualquier nombre que no esté en el mapa se muestra tal cual llega.
 */
const NOMBRES_CORTOS: Record<string, string> = {
  "Almacenamiento (Baterías)": "BESS",
};

export function technologyDisplayName(nombre: string): string;
export function technologyDisplayName(nombre: string | null): string | null;
export function technologyDisplayName(nombre: string | null): string | null {
  if (nombre === null) return null;
  return NOMBRES_CORTOS[nombre] ?? nombre;
}
