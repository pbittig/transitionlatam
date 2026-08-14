"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { followProject, unfollowProject, setAppSetting } from "@/lib/data-access/watchlist";

/** Seguir/dejar de seguir un proyecto — requiere sesión de admin (ver lib/auth/session.ts). */
export async function toggleFollow(projectId: string, follow: boolean): Promise<{ success: boolean; error?: string }> {
  if (!(await isAdmin())) {
    return { success: false, error: "Debes iniciar sesión como administrador." };
  }
  try {
    const client = createSupabaseServiceClient();
    if (follow) {
      await followProject(client, projectId);
    } else {
      await unfollowProject(client, projectId);
    }
    revalidatePath(`/proyectos/${projectId}`);
    revalidatePath("/seguimiento");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/** Prender/apagar una configuración global de la app (ej. avisos de proyectos nuevos) — requiere sesión de admin. */
export async function toggleAppSetting(key: string, value: boolean): Promise<{ success: boolean; error?: string }> {
  if (!(await isAdmin())) {
    return { success: false, error: "Debes iniciar sesión como administrador." };
  }
  try {
    await setAppSetting(createSupabaseServiceClient(), key, value);
    revalidatePath("/seguimiento");
    // El modo mantenimiento se lee en la pantalla de ingreso, que es
    // force-dynamic pero igual se cachea por request: sin esto, prenderlo no
    // se refleja hasta la siguiente navegación.
    revalidatePath("/ingresar");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
