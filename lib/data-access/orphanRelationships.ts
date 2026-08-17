import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Vínculos de `entity_relationship` que apuntan a algo que ya no existe.
 *
 * POR QUÉ SE ACUMULAN: la tabla guarda el par (tipo, id) en columnas genéricas,
 * sin llave foránea. Postgres no puede protegerla: borrar un proyecto o una
 * empresa no arrastra sus vínculos ni avisa que quedaron colgando. Se
 * acumularon con los borrados de proyectos y con las limpiezas de julio.
 *
 * SE SEPARAN EN DOS CLASES PORQUE SE ARREGLAN DISTINTO:
 *
 * - Los que apuntan a una EMPRESA borrada tienen un origen vivo (una persona,
 *   un proyecto, una SPV) que perdió su vínculo. Ahí hay algo que decidir: a
 *   qué empresa corresponde ahora, o si el vínculo ya no aplica.
 * - Los que involucran un PROYECTO borrado no tienen a qué reapuntar: el
 *   proyecto no existe. Son residuo y lo único sensato es quitarlos.
 *
 * No se borran solos: un vínculo perdido puede ser la única pista de que un
 * borrado se llevó más de lo que correspondía.
 */
export type OrphanKind = "company_target" | "project_gone";

export interface OrphanRelationship {
  id: string;
  kind: OrphanKind;
  relationshipType: string;
  /** Nombre de la punta que sigue viva, o null si las dos se perdieron. */
  origen: string | null;
  origenTipo: string;
  createdAt: string;
}

interface OrphanRow {
  id: string;
  relationship_type: string;
  source_type: string;
  created_at: string;
  origen: string | null;
}

/**
 * Se consulta con SQL crudo y no con el cliente de Supabase porque la pregunta
 * es "no existe en la otra tabla": PostgREST no expresa un NOT EXISTS contra
 * una tabla que no está relacionada por llave foránea, y emularlo traería las
 * ~10.000 filas de entity_relationship al proceso para filtrarlas en memoria.
 */
export async function getOrphanRelationships(
  client: SupabaseClient,
  limitePorClase = 100,
): Promise<{ items: OrphanRelationship[]; totales: Record<OrphanKind, number> }> {
  const { data, error } = await client.rpc("get_orphan_relationships", { limite: limitePorClase });
  if (error) throw new Error(`Error obteniendo vínculos huérfanos: ${error.message}`);

  const payload = data as { items: Array<OrphanRow & { kind: OrphanKind }>; totales: Record<OrphanKind, number> };
  return {
    items: (payload?.items ?? []).map((row) => ({
      id: row.id,
      kind: row.kind,
      relationshipType: row.relationship_type,
      origen: row.origen,
      origenTipo: row.source_type,
      createdAt: row.created_at,
    })),
    totales: payload?.totales ?? { company_target: 0, project_source: 0, project_target: 0 },
  };
}
