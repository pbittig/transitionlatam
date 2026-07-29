import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSolicitudesFromApi, normalizeApiRow } from "./fetchFromApi";
import { loadNormalizedProjects, type LoadSummary } from "./load";
import { recordPipelineSync } from "@/lib/data-access/pipeline";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";

/**
 * Punto único de la sincronización del listado — usado por scripts/sync-listado.ts
 * (corrida manual) y por app/api/cron/sync-listado/route.ts (cron real de la
 * plataforma de hosting). Nunca dupliques el fetch+load acá, solo invócalo.
 */
export async function runListadoSync(client?: SupabaseClient): Promise<LoadSummary> {
  const supabase = client ?? createSupabaseServiceClient();
  const rawRows = await fetchSolicitudesFromApi();
  const normalized = rawRows.map(normalizeApiRow);
  const summary = await loadNormalizedProjects(supabase, normalized);
  await recordPipelineSync(supabase);
  return summary;
}
