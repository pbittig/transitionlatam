import type { SupabaseClient } from "@supabase/supabase-js";

export interface ConstructionStats {
  count: number;
  totalPotenciaMw: number;
  bessCount: number;
}

/** Proyectos "en construcción" según CNE (Declaración en Construcción) — ver scripts/sync-cne-construccion.ts. */
export async function getConstructionStats(client: SupabaseClient): Promise<ConstructionStats> {
  const { data, error } = await client.from("construction_project").select("potencia_neta_mw, tipo_tecnologia");
  if (error) throw new Error(`Error obteniendo proyectos en construcción: ${error.message}`);

  const rows = data ?? [];
  const totalPotenciaMw = rows.reduce((sum, r) => sum + (Number(r.potencia_neta_mw) || 0), 0);
  const bessCount = rows.filter((r) => /bess/i.test((r.tipo_tecnologia as string) ?? "")).length;

  return { count: rows.length, totalPotenciaMw, bessCount };
}

export interface ConstructionProjectItem {
  id: string;
  proyectoCentral: string;
  proyectoBessAsociado: string | null;
  propietario: string | null;
  tipoTecnologiaFinal: string | null;
  potenciaNetaMw: number | null;
  region: string | null;
  fechaEstimadaInterconexion: string | null;
}

/** Listado completo de proyectos en construcción, más próximos a interconectarse primero. */
export async function getConstructionProjects(client: SupabaseClient): Promise<ConstructionProjectItem[]> {
  const { data, error } = await client
    .from("construction_project")
    .select("id, proyecto_central, proyecto_bess_asociado, propietario, tipo_tecnologia_final, potencia_neta_mw, region, fecha_estimada_interconexion")
    .order("fecha_estimada_interconexion", { ascending: true, nullsFirst: false });
  if (error) throw new Error(`Error obteniendo listado de proyectos en construcción: ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    proyectoCentral: r.proyecto_central as string,
    proyectoBessAsociado: r.proyecto_bess_asociado as string | null,
    propietario: r.propietario as string | null,
    tipoTecnologiaFinal: r.tipo_tecnologia_final as string | null,
    potenciaNetaMw: r.potencia_neta_mw as number | null,
    region: r.region as string | null,
    fechaEstimadaInterconexion: r.fecha_estimada_interconexion as string | null,
  }));
}
