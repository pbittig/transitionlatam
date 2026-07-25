import { sipubGet } from "../shared/client";
import type { EmpresasPage, RawEmpresa } from "./types";

const REQUESTED_PAGE_SIZE = 200;

/**
 * Pagina todo el registro de empresas coordinadas (~1422 filas, ver ADR-019).
 * El servidor limita silenciosamente `limit` a 100 sin importar lo solicitado —
 * el offset debe avanzar según el tamaño real de página devuelto, no el pedido,
 * o se saltan la mitad de las filas (bug real observado la primera vez que se corrió).
 */
export async function fetchAllEmpresas(): Promise<RawEmpresa[]> {
  const all: RawEmpresa[] = [];
  let offset = 0;
  while (true) {
    const page = await sipubGet<EmpresasPage>("/api/v2/recursos/infotecnica/empresas/", {
      limit: REQUESTED_PAGE_SIZE,
      offset,
    });
    all.push(...page.results);
    if (!page.next || page.results.length === 0) break;
    offset += page.results.length;
  }
  return all;
}
