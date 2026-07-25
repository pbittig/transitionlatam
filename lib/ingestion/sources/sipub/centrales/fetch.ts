import { sipubGet } from "../shared/client";
import type { CentralesPage, RawCentral } from "./types";

const PAGE_SIZE = 500;

/** Pagina todo el registro de centrales (~1362 filas, ver ADR-019). */
export async function fetchAllCentrales(): Promise<RawCentral[]> {
  const all: RawCentral[] = [];
  let page = 1;
  while (true) {
    const result = await sipubGet<CentralesPage>("/centrales/v4/findByDate", {
      limit: PAGE_SIZE,
      page,
    });
    all.push(...result.data);
    if (page >= result.totalPages) break;
    page += 1;
  }
  return all;
}
