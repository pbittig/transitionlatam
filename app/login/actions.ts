"use server";

import { redirect } from "next/navigation";
import { createSession, deleteSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";

export interface LoginState {
  error?: string;
}

export async function login(_prevState: LoginState | undefined, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const validUsername = process.env.ADMIN_USERNAME;
  const validPassword = process.env.ADMIN_PASSWORD;

  if (!validUsername || !validPassword || username !== validUsername || password !== validPassword) {
    return { error: "Usuario o clave incorrectos." };
  }

  await createSession(username);
  redirect("/");
}

/**
 * Logout compartido (usado por el botón "Cerrar sesión" del Sidebar/MobileNavigation
 * para cualquier usuario, no solo admin) — cierra AMBAS sesiones posibles: la cookie
 * de admin (createSession/deleteSession, panel /login) y la sesión real de Supabase
 * Auth (cuenta de plataforma, /ingresar). Antes solo borraba la cookie de admin y
 * mandaba a /login — un usuario normal quedaba con su sesión de Supabase intacta pese
 * a hacer clic en "Cerrar sesión". Redirige a /ingresar, la landing para sin sesión.
 */
export async function logout(): Promise<void> {
  "use server";
  await deleteSession();
  const client = await createSupabaseServerClient();
  await client.auth.signOut();
  redirect("/ingresar");
}
