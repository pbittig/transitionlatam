"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { deleteSession } from "@/lib/auth/session";
import { isMaintenanceMode } from "@/lib/maintenance";

export interface IngresarState {
  error?: string;
}

export async function ingresar(_prevState: IngresarState | undefined, formData: FormData): Promise<IngresarState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingrese su correo y clave." };
  }

  // Se comprueba acá y no solo en la página: el modal tapa el formulario, pero
  // un server action se puede invocar sin pasar por la pantalla. Sin esta
  // línea, el modo mantenimiento sería un cartel, no un candado.
  if (await isMaintenanceMode()) {
    return { error: "El sistema está en mantenimiento. El ingreso está temporalmente deshabilitado." };
  }

  const client = await createSupabaseServerClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Correo o clave incorrectos." };
  }

  // Una sesión admin previa no debe elevar los permisos de la cuenta cliente
  // que acaba de autenticarse en el mismo navegador.
  await deleteSession();
  redirect("/proyectos");
}

export async function cerrarSesionCliente(): Promise<void> {
  "use server";
  await deleteSession();
  const client = await createSupabaseServerClient();
  await client.auth.signOut();
  redirect("/ingresar");
}

export async function logout(): Promise<void> {
  await cerrarSesionCliente();
}
