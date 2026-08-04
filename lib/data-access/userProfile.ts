import type { SupabaseClient } from "@supabase/supabase-js";

export interface CurrentUserProfile {
  id: string;
  email: string;
  fullName: string | null;
  companyName: string | null;
  mobilePhone: string | null;
  country: string | null;
  avatarUrl: string | null;
  planCode: string | null;
  trialEndsAt: string | null;
  preferredLanguage: "es" | "en";
  organizationId: string | null;
}

/** Perfil de la cuenta de autoservicio actualmente logueada (Supabase Auth) — distinto del admin único (cookie jose, ver lib/auth/session.ts). */
export async function getCurrentUserProfile(client: SupabaseClient): Promise<CurrentUserProfile | null> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;

  const { data: localizedData, error } = await client
    .from("user_profile")
    .select("id, email, full_name, company_name, mobile_phone, country, avatar_url, trial_ends_at, preferred_language, organization_id, plan:plan_id(code)")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  let data = localizedData;
  if (error?.code === "42703" || error?.code === "PGRST204") {
    const { data: legacyData, error: legacyError } = await client
      .from("user_profile")
      .select("id, email, full_name, company_name, country, avatar_url, trial_ends_at, organization_id, plan:plan_id(code)")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (legacyError) throw new Error(`Error obteniendo perfil de usuario: ${legacyError.message}`);
    data = legacyData ? { ...legacyData, mobile_phone: null, preferred_language: "es" } : null;
  } else if (error) {
    throw new Error(`Error obteniendo perfil de usuario: ${error.message}`);
  }
  if (!data) return null;

  return {
    id: data.id as string,
    email: data.email as string,
    fullName: data.full_name as string | null,
    companyName: data.company_name as string | null,
    mobilePhone: data.mobile_phone as string | null,
    country: data.country as string | null,
    avatarUrl: data.avatar_url as string | null,
    planCode: (data.plan as unknown as { code: string } | null)?.code ?? null,
    trialEndsAt: data.trial_ends_at as string | null,
    preferredLanguage: data.preferred_language === "en" ? "en" : "es",
    organizationId: data.organization_id as string | null,
  };
}

export async function updateCurrentUserProfile(
  client: SupabaseClient,
  userProfileId: string,
  updates: { fullName?: string; companyName?: string; avatarUrl?: string },
): Promise<void> {
  const patch: Record<string, string> = {};
  if (updates.fullName !== undefined) patch.full_name = updates.fullName;
  if (updates.companyName !== undefined) patch.company_name = updates.companyName;
  if (updates.avatarUrl !== undefined) patch.avatar_url = updates.avatarUrl;
  if (Object.keys(patch).length === 0) return;

  const { error } = await client.from("user_profile").update(patch).eq("id", userProfileId);
  if (error) throw new Error(`Error actualizando perfil: ${error.message}`);
}
