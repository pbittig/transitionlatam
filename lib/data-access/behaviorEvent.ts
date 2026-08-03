import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUserProfile } from "./userProfile";
import { recordAndCheckRate } from "@/lib/security/rateLimit";

/**
 * Registra qué mira cada cuenta de autoservicio — la señal base para la
 * estadística de uso por empresa que pide el modelo de leads (ver
 * behavior_event en 20260720000003_users_and_leads.sql). No bloquea el
 * render de la página si falla (instrumentación, no funcionalidad crítica) y
 * no hace nada si no hay sesión de cliente activa (visitante anónimo o admin).
 *
 * De paso alimenta el rate limit anti-scraping (docs/09-seguridad.md §9.4/9.6)
 * — misma llamada, no un sistema paralelo.
 */
export async function logProjectView(client: SupabaseClient, projectId: string): Promise<void> {
  try {
    const profile = await getCurrentUserProfile(client);
    if (!profile) return;
    await client.from("behavior_event").insert({
      user_profile_id: profile.id,
      event_type: "project_view",
      entity_type: "project",
      entity_id: projectId,
    });
    await recordAndCheckRate(profile.id, "project_view", { limit: 60, windowSeconds: 300 });
  } catch {
    // instrumentación best-effort — nunca debe romper la página
  }
}
