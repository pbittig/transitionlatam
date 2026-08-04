import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";

/**
 * Único chequeo que necesita hoy la UI pública: ¿este visitante ve el contenido
 * completo o la versión con candado? La oferta vigente solo contempla Free y
 * Premium (Prime); sin sesión se usa Free como valor por defecto.
 */
export async function getIsFreeTier(client: SupabaseClient): Promise<boolean> {
  const profile = await getCurrentUserProfile(client);
  const planCode = profile?.planCode ?? "free";
  return planCode !== "premium";
}
