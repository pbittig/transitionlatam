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

export interface ConstructionDeclaration {
  /** Resolución que declaró el proyecto en construcción — el acto administrativo citable. */
  resolution: string | null;
  /** Número y fecha de la resolución vigente con que se descargó la nómina. */
  currentResolutionNumber: string;
  currentResolutionDate: string;
  originalInterconnectionDate: string | null;
  estimatedInterconnectionDate: string | null;
  netPowerMw: number | null;
  syncedAt: string;
  /** Cómo se vinculó a este proyecto: "human" o "auto_<regla>" — ver 20260812000004. */
  matchedBy: string | null;
}

/**
 * Declaración en Construcción de CNE asociada a un proyecto. Es la única fuente
 * que entrega el acto administrativo con número de resolución: el estado del
 * Coordinador dice que el proyecto fue declarado, esto dice con qué resolución.
 * Puede existir aunque el estado del Coordinador todavía no lo refleje — ese
 * desfase es información, no un error (ver docs/11 §14, regla R3).
 */
export async function getConstructionDeclarationForProject(
  client: SupabaseClient,
  projectId: string,
): Promise<ConstructionDeclaration | null> {
  const { data, error } = await client
    .from("construction_project")
    .select(
      "res_original, num_res, fecha_res, fecha_original_interconexion, fecha_estimada_interconexion, potencia_neta_mw, synced_at, match_confirmed_by",
    )
    .eq("project_id", projectId)
    .maybeSingle();
  // La columna project_id es aditiva: sin la migración aplicada se sigue sin declaración.
  if (error?.code === "42703" || error?.code === "PGRST204" || error?.code === "PGRST205") return null;
  if (error) throw new Error(`Error obteniendo la declaración en construcción: ${error.message}`);
  if (!data) return null;
  return {
    resolution: data.res_original as string | null,
    currentResolutionNumber: data.num_res as string,
    currentResolutionDate: data.fecha_res as string,
    originalInterconnectionDate: data.fecha_original_interconexion as string | null,
    estimatedInterconnectionDate: data.fecha_estimada_interconexion as string | null,
    netPowerMw: data.potencia_neta_mw === null ? null : Number(data.potencia_neta_mw),
    syncedAt: data.synced_at as string,
    matchedBy: (data.match_confirmed_by ?? null) as string | null,
  };
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
