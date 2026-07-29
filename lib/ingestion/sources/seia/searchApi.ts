import type { SeiaSearchResponse } from "./types";

const SEARCH_URL = "https://seia.sea.gob.cl/busqueda/buscarProyectoResumenAction.php";

/**
 * Busca expedientes SEIA por nombre de proyecto — el mismo endpoint que usa el
 * buscador público (`buscarProyectoResumen.php`), sirviendo la tabla vía
 * DataTables server-side. No requiere autenticación. El filtro `id_tipoexpediente`
 * (categoría de proyecto) devuelve error de servidor con el código corto que
 * muestra la UI ("c") — espera un ID interno que no pudimos determinar, así que
 * se filtra por tipo del lado del cliente (ver normalize.ts) en vez de acá.
 */
// Sectores económicos relevantes para energía — confirmado empíricamente (barrido de
// valores 1-14). 7 = "Energía" (termoeléctricas, solares, subestaciones, líneas de
// transmisión) y por el usuario directamente:
// https://seia.sea.gob.cl/busqueda/buscarProyectoResumen.php?sectores_economicos=7
// 13 = "Presas y embalses" — ahí es donde SEIA clasifica las centrales hidroeléctricas,
// NO en "Energía" (hallazgo real: "CENTRAL HIDROELÉCTRICA FRONTERA",
// https://seia.sea.gob.cl/expediente/expediente.php?id_expediente=2130098261, invisible
// en nuestra búsqueda hasta agregar este sector). El endpoint acepta varios sectores
// separados por coma en un solo parámetro (confirmado contra el buscador real).
const ENERGY_SECTOR_IDS = "7,13";

// El servidor espera el body del form en ISO-8859-1 (mismo charset que declara en la
// respuesta, ver más abajo) — URLSearchParams siempre codifica en UTF-8 sin forma de
// cambiarlo, lo que corrompía cualquier tilde/ñ en `nombre` (ej. "Marañón" -> bytes
// UTF-8 interpretados como Latin-1 por el servidor = no matchea nada, 0 resultados).
// Hallazgo real: "Llanos de Marañón" no encontraba "Parque Fotovoltaico Llanos de
// Marañón" pese a existir en SEIA, hasta corregir la codificación acá.
function latin1FormEncode(params: Record<string, string>): string {
  const encodeValue = (input: string): string =>
    [...input]
      .map((ch) => {
        const code = ch.codePointAt(0)!;
        if ((code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a) || ch === "-" || ch === "_" || ch === ".") {
          return ch;
        }
        if (ch === " ") return "+";
        if (code <= 0xff) return `%${code.toString(16).padStart(2, "0").toUpperCase()}`;
        return encodeURIComponent(ch);
      })
      .join("");
  return Object.entries(params)
    .map(([key, value]) => `${key}=${encodeValue(value)}`)
    .join("&");
}

async function searchSeia(nombre: string, titular: string, limit = 20): Promise<SeiaSearchResponse> {
  const body = latin1FormEncode({
    nombre,
    titular,
    folio: "",
    selectRegion: "",
    selectComuna: "",
    tipoPresentacion: "",
    projectStatus: "",
    PresentacionMin: "",
    PresentacionMax: "",
    CalificaMin: "",
    CalificaMax: "",
    sectores_economicos: ENERGY_SECTOR_IDS,
    razoningreso: "",
    id_tipoexpediente: "",
    offset: "1",
    limit: String(limit),
  });

  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TransitionLATAM-market-intelligence/1.0",
    },
    body,
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`SEIA búsqueda respondió ${res.status} ${res.statusText}`);

  // El servidor declara `charset=ISO-8859-1`, pero fetch().json()/.text() siempre
  // decodifica como UTF-8 sin importar ese header (comportamiento fijo del spec
  // Fetch) — eso corrompía las tildes ("EÓLICO" -> "E�LICO"). Se decodifica el
  // buffer crudo con el charset real antes de parsear.
  const buffer = await res.arrayBuffer();
  const text = new TextDecoder("iso-8859-1").decode(buffer);
  const json = JSON.parse(text) as SeiaSearchResponse;
  if (!json.status) throw new Error("SEIA búsqueda devolvió status=false");
  return json;
}

export async function searchSeiaByName(nombre: string, limit = 20): Promise<SeiaSearchResponse> {
  return searchSeia(nombre, "", limit);
}

export async function searchSeiaByTitular(titular: string, limit = 20): Promise<SeiaSearchResponse> {
  return searchSeia("", titular, limit);
}
