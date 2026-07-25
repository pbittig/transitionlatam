import { sipubGet } from "../shared/client";
import type { LineasPage, RawLinea } from "./types";

const PAGE_SIZE = 500;

/** Pagina todas las líneas de transmisión (~1700-2000 filas, ver migración 20260721000010). */
export async function fetchAllLineas(): Promise<RawLinea[]> {
  const all: RawLinea[] = [];
  let page = 1;
  while (true) {
    const result = await sipubGet<LineasPage>("/lineas-transmision/v4/findByDate", { limit: PAGE_SIZE, page });
    all.push(...result.data);
    if (page >= result.totalPages) break;
    page += 1;
  }
  return all;
}
