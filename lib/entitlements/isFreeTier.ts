import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";

/**
 * Único chequeo que necesita hoy la UI pública: ¿este visitante ve el contenido
 * completo o la versión con candado? Lite y Premium ven exactamente lo mismo
 * por ahora (decisión confirmada con el usuario 2026-07-28, pendiente de
 * diferenciar más adelante) — así que solo importa si el plan es "free" (o no
 * hay sesión, que es el caso por defecto para un visitante anónimo).
 */
export async function getIsFreeTier(client: SupabaseClient): Promise<boolean> {
  const profile = await getCurrentUserProfile(client);
  const planCode = profile?.planCode ?? "free";
  return planCode !== "lite" && planCode !== "premium";
}
