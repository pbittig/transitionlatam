"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";

/** El cambio detectado es correcto: se confirma sin tocar verified_at. */
export async function confirmReverification(projectId: string): Promise<void> {
  if (!(await isAdmin())) throw new Error("No autorizado.");
  const { error } = await createSupabaseServiceClient()
    .from("project")
    .update({ needs_reverification: false, reverification_reason: null })
    .eq("id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/revision-dudosos");
  revalidatePath("/admin");
}

/** El cambio requiere revisión completa: vuelve a la cola normal del Verificador. */
export async function sendBackToVerification(projectId: string): Promise<void> {
  if (!(await isAdmin())) throw new Error("No autorizado.");
  const { error } = await createSupabaseServiceClient()
    .from("project")
    .update({ needs_reverification: false, reverification_reason: null, verified_at: null })
    .eq("id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/revision-dudosos");
  revalidatePath("/admin/verificador");
  revalidatePath("/admin");
}
