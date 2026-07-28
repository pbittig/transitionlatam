import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetchSolicitudesFromApi, normalizeApiRow } from "./fetchFromApi";
import { loadNormalizedProjects, type LoadSummary } from "./load";

/**
 * Punto único de la sincronización del listado — usado por scripts/sync-listado.ts
 * (corrida manual) y por app/api/cron/sync-listado/route.ts (cron real de la
 * plataforma de hosting). Nunca dupliques el fetch+load acá, solo invócalo.
 */
export async function runListadoSync(client?: SupabaseClient): Promise<LoadSummary> {
  const supabase = client ?? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const rawRows = await fetchSolicitudesFromApi();
  const normalized = rawRows.map(normalizeApiRow);
  return loadNormalizedProjects(supabase, normalized);
}
