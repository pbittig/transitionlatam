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
// Sector económico "Energía" — confirmado empíricamente (barrido de valores 1-12,
// sector=7 devuelve "Central Termoeléctrica Laja" y similares) y por el usuario
// directamente: https://seia.sea.gob.cl/busqueda/buscarProyectoResumen.php?sectores_economicos=7
const ENERGY_SECTOR_ID = "7";

export async function searchSeiaByName(nombre: string, limit = 20): Promise<SeiaSearchResponse> {
  const body = new URLSearchParams({
    nombre,
    titular: "",
    folio: "",
    selectRegion: "",
    selectComuna: "",
    tipoPresentacion: "",
    projectStatus: "",
    PresentacionMin: "",
    PresentacionMax: "",
    CalificaMin: "",
    CalificaMax: "",
    sectores_economicos: ENERGY_SECTOR_ID,
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
    body: body.toString(),
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
