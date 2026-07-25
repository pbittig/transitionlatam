import type { SupabaseClient } from "@supabase/supabase-js";

export interface Entitlements {
  planCode: string;
  features: Map<string, Record<string, unknown>>; // feature code -> limit_config
}

const DEFAULT_PLAN_CODE = "free";

/**
 * Resolves what a user can do — the single source of truth consulted by API
 * routes, Transition AI tools, and UI (to reflect state, never to decide access).
 * See /docs/08-modelo-suscripciones.md §8.4.
 */
export async function resolveEntitlements(
  client: SupabaseClient,
  userProfileId: string | null,
): Promise<Entitlements> {
  if (!userProfileId) {
    return resolvePlanByCode(client, DEFAULT_PLAN_CODE);
  }

  const { data: profile, error } = await client
    .from("user_profile")
    .select("id, plan_id, organization_id, organization:organization_id(plan_id)")
    .eq("id", userProfileId)
    .maybeSingle();
  if (error) throw new Error(`Error resolviendo perfil de usuario: ${error.message}`);
  if (!profile) return resolvePlanByCode(client, DEFAULT_PLAN_CODE);

  const org = profile.organization as unknown as { plan_id: string } | null;
  const planId = org?.plan_id ?? (profile.plan_id as string | null);

  const base = planId
    ? await resolvePlanById(client, planId)
    : await resolvePlanByCode(client, DEFAULT_PLAN_CODE);

  const { data: overrides } = await client
    .from("entitlement_override")
    .select("feature_id, limit_config, expires_at, feature:feature_id(code)")
    .or(`user_profile_id.eq.${userProfileId},organization_id.eq.${profile.organization_id ?? "00000000-0000-0000-0000-000000000000"}`);

  const now = Date.now();
  for (const row of overrides ?? []) {
    const r = row as unknown as {
      limit_config: Record<string, unknown>;
      expires_at: string | null;
      feature: { code: string } | null;
    };
    if (!r.feature) continue;
    if (r.expires_at && new Date(r.expires_at).getTime() < now) continue;
    base.features.set(r.feature.code, r.limit_config);
  }

  return base;
}

async function resolvePlanById(client: SupabaseClient, planId: string): Promise<Entitlements> {
  const { data: plan, error } = await client.from("plan").select("code").eq("id", planId).single();
  if (error || !plan) return resolvePlanByCode(client, DEFAULT_PLAN_CODE);
  return loadPlanFeatures(client, planId, plan.code as string);
}

async function resolvePlanByCode(client: SupabaseClient, code: string): Promise<Entitlements> {
  const { data: plan, error } = await client.from("plan").select("id, code").eq("code", code).single();
  if (error || !plan) return { planCode: code, features: new Map() };
  return loadPlanFeatures(client, plan.id as string, plan.code as string);
}

async function loadPlanFeatures(client: SupabaseClient, planId: string, planCode: string): Promise<Entitlements> {
  const { data: rows, error } = await client
    .from("plan_feature")
    .select("limit_config, feature:feature_id(code)")
    .eq("plan_id", planId);
  if (error) throw new Error(`Error cargando features del plan: ${error.message}`);

  const features = new Map<string, Record<string, unknown>>();
  for (const row of rows ?? []) {
    const r = row as unknown as { limit_config: Record<string, unknown>; feature: { code: string } | null };
    if (r.feature) features.set(r.feature.code, r.limit_config);
  }

  return { planCode, features };
}
