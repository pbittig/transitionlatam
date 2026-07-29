"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";

export interface UserActionState {
  success?: string;
  error?: string;
}

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("No autorizado.");
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createUserAction(_: UserActionState, formData: FormData): Promise<UserActionState> {
  await requireAdmin();
  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");
  const fullName = text(formData, "fullName");
  const planId = text(formData, "planId");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Ingresa un correo válido." };
  if (password.length < 10) return { error: "La contraseña temporal debe tener al menos 10 caracteres." };
  if (!planId) return { error: "Selecciona un plan." };

  const client = createSupabaseServiceClient();
  const { data: plan } = await client.from("plan").select("id").eq("id", planId).maybeSingle();
  if (!plan) return { error: "El plan seleccionado no existe." };

  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName || null, created_by_admin: true },
  });
  if (error || !data.user) return { error: error?.message ?? "No se pudo crear el usuario." };

  const { error: profileError } = await client.from("user_profile").upsert(
    {
      auth_user_id: data.user.id,
      email,
      full_name: fullName || null,
      plan_id: planId,
      trial_ends_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "auth_user_id" },
  );
  if (profileError) {
    await client.auth.admin.deleteUser(data.user.id);
    return { error: `No se pudo crear el perfil: ${profileError.message}` };
  }
  revalidatePath("/admin/usuarios");
  return { success: `Usuario ${email} creado y habilitado.` };
}

export async function updateUserPlanAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = text(formData, "userId");
  const planId = text(formData, "planId");
  const client = createSupabaseServiceClient();
  const { data: plan } = await client.from("plan").select("id").eq("id", planId).maybeSingle();
  if (!userId || !plan) throw new Error("Usuario o plan inválido.");
  const { error } = await client
    .from("user_profile")
    .update({ plan_id: planId, trial_ends_at: null, updated_at: new Date().toISOString() })
    .eq("auth_user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/usuarios");
}

export async function setUserEnabledAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = text(formData, "userId");
  const enabled = text(formData, "enabled") === "true";
  if (!userId) throw new Error("Usuario inválido.");
  const client = createSupabaseServiceClient();
  const { error } = await client.auth.admin.updateUserById(userId, {
    ban_duration: enabled ? "none" : "876000h",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/usuarios");
}
