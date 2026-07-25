import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedEmpresa } from "./types";

export interface EmpresasLoadSummary {
  totalRows: number;
  upserted: number;
}

const UPSERT_BATCH_SIZE = 200;

export async function loadEmpresas(
  client: SupabaseClient,
  empresas: NormalizedEmpresa[],
): Promise<EmpresasLoadSummary> {
  const rows = empresas.map((e) => ({
    id_infotecnica: e.idInfotecnica,
    nombre: e.nombre,
    name_normalized: e.nameNormalized,
    grupo: e.grupo,
    giro: e.giro,
    mnemotecnico: e.mnemotecnico,
    numero: e.numero,
    descripcion: e.descripcion,
    is_hidden: e.isHidden,
    synced_at: new Date().toISOString(),
  }));

  let upserted = 0;
  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await client.from("coordinador_empresa").upsert(batch, { onConflict: "id_infotecnica" });
    if (error) throw new Error(`Error al cargar coordinador_empresa (batch ${i}): ${error.message}`);
    upserted += batch.length;
  }

  return { totalRows: empresas.length, upserted };
}
