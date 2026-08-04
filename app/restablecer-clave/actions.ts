"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";

export interface RestablecerClaveState {
  error?: string;
}

export async function restablecerClave(
  _prevState: RestablecerClaveState | undefined,
  formData: FormData,
): Promise<RestablecerClaveState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return { error: "La clave debe tener al menos 8 caracteres." };
  }
  if (password !== confirmPassword) {
    return { error: "Las claves no coinciden." };
  }

  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { error: "El enlace de restablecimiento ya no es válido. Solicite uno nuevo." };
  }

  const { error } = await client.auth.updateUser({ password });
  if (error) {
    return { error: `No pudimos actualizar la clave: ${error.message}` };
  }

  // Cierra la sesión de recuperación a propósito: el usuario vuelve a entrar
  // con la clave nueva desde /ingresar, confirmando que realmente quedó bien.
  await client.auth.signOut();
  redirect("/ingresar?clave_actualizada=1");
}
