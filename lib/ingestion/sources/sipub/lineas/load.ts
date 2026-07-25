import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedLinea } from "./types";

const BATCH_SIZE = 200;

export async function loadLineas(client: SupabaseClient, lineas: NormalizedLinea[]): Promise<number> {
  // La API devuelve id_linea duplicado entre páginas (mismo registro repetido) —
  // un upsert no puede afectar la misma fila dos veces dentro de un mismo batch.
  const byId = new Map<number, NormalizedLinea>();
  for (const l of lineas) byId.set(l.idLinea, l);

  const rows = [...byId.values()].map((l) => ({
    id_linea: l.idLinea,
    nombre: l.nombre,
    codigo_linea: l.codigoLinea,
    voltage_kv: l.voltageKv,
    owner_name: l.ownerName,
    coordinado_name: l.coordinadoName,
    synced_at: new Date().toISOString(),
  }));

  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await client.from("transmission_line").upsert(batch, { onConflict: "id_linea" });
    if (error) throw new Error(`Error al cargar transmission_line (batch ${i}): ${error.message}`);
    upserted += batch.length;
  }
  return upserted;
}
