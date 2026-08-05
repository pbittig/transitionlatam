"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";

async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("No autorizado.");
}

/** Confirma el proyecto sugerido como el match real. */
export async function confirmPertinenciaMatch(pertinenciaId: string, projectId: string): Promise<void> {
  await requireAdmin();
  const { error } = await createSupabaseServiceClient()
    .from("pertinencia_consulta")
    .update({ match_status: "confirmed", matched_project_id: projectId })
    .eq("id", pertinenciaId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/pertinencias");
  revalidatePath("/admin");
}

/** El match sugerido está mal — vuelve a quedar pendiente de revisión manual (sin sugerencia). */
export async function rejectPertinenciaMatch(pertinenciaId: string): Promise<void> {
  await requireAdmin();
  const { error } = await createSupabaseServiceClient()
    .from("pertinencia_consulta")
    .update({ match_status: "rejected", suggested_project_id: null, suggested_match_score: null })
    .eq("id", pertinenciaId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/pertinencias");
  revalidatePath("/admin");
}

/** No corresponde a ningún proyecto en el sistema todavía (ej. modificación de un proyecto que no hemos cargado). */
export async function markPertinenciaNoMatch(pertinenciaId: string): Promise<void> {
  await requireAdmin();
  const { error } = await createSupabaseServiceClient()
    .from("pertinencia_consulta")
    .update({ match_status: "no_match_available" })
    .eq("id", pertinenciaId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/pertinencias");
  revalidatePath("/admin");
}
