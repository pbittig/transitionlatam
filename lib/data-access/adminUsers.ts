import "server-only";
import { createSupabaseServiceClient } from "./supabase-service-client";

export interface AdminUserRow {
  id: string;
  email: string;
  fullName: string | null;
  planCode: string;
  planName: string;
  enabled: boolean;
  emailConfirmed: boolean;
  createdAt: string;
  lastSignInAt: string | null;
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const client = createSupabaseServiceClient();
  const [{ data: authData, error: authError }, { data: profiles, error: profileError }, { data: plans, error: planError }] =
    await Promise.all([
      client.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      client.from("user_profile").select("auth_user_id, email, full_name, plan_id"),
      client.from("plan").select("id, code, name"),
    ]);
  if (authError) throw new Error(`No se pudieron cargar los usuarios: ${authError.message}`);
  if (profileError) throw new Error(`No se pudieron cargar los perfiles: ${profileError.message}`);
  if (planError) throw new Error(`No se pudieron cargar los planes: ${planError.message}`);

  const profileByAuthId = new Map((profiles ?? []).map((profile) => [profile.auth_user_id as string, profile]));
  const planById = new Map((plans ?? []).map((plan) => [plan.id as string, plan]));

  return authData.users.map((user) => {
    const profile = profileByAuthId.get(user.id);
    const plan = profile?.plan_id ? planById.get(profile.plan_id as string) : null;
    return {
      id: user.id,
      email: user.email ?? profile?.email ?? "Sin correo",
      fullName: (profile?.full_name as string | null) ?? null,
      planCode: (plan?.code as string | undefined) ?? "free",
      planName: (plan?.name as string | undefined) ?? "Free",
      enabled: !user.banned_until || new Date(user.banned_until) <= new Date(),
      emailConfirmed: !!user.email_confirmed_at,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at ?? null,
    };
  });
}

export async function listPlans() {
  const client = createSupabaseServiceClient();
  const { data, error } = await client.from("plan").select("id, code, name").order("name");
  if (error) throw new Error(`No se pudieron cargar los planes: ${error.message}`);
  return data ?? [];
}
