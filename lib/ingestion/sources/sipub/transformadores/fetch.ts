import { sipubGet } from "../shared/client";
import type { RawTransformador2d, Transformadores2dPage } from "./types";

// El servidor cap a 10 filas por página sin importar el limit solicitado
// (mismo comportamiento real que /api/v2/recursos/infotecnica/empresas/) — se
// pagina por `page`, ~2800 transformadores en total.
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchAllTransformadores2d(): Promise<RawTransformador2d[]> {
  const all: RawTransformador2d[] = [];
  let page = 1;
  while (true) {
    const result = await sipubGet<Transformadores2dPage>("/transformadores-2d/v3/findAll", { page });
    all.push(...result.data);
    if (page >= result.totalPages || result.data.length === 0) break;
    page += 1;
    await sleep(150);
  }
  return all;
}
