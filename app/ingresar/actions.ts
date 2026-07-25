"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";

export interface IngresarState {
  error?: string;
}

export async function ingresar(_prevState: IngresarState | undefined, formData: FormData): Promise<IngresarState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresa tu correo y clave." };
  }

  const client = await createSupabaseServerClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Correo o clave incorrectos." };
  }

  redirect("/");
}

export async function cerrarSesionCliente(): Promise<void> {
  "use server";
  const client = await createSupabaseServerClient();
  await client.auth.signOut();
  redirect("/ingresar");
}
