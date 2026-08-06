"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";

async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("No autorizado.");
}

export interface PertinenciaSearchCandidate {
  id: string;
  name: string;
  titularName: string | null;
  correlativeId: string;
  estado: string | null;
  subEstado: string | null;
  fechaPresentacion: string | null;
  matchStatus: "pending" | "confirmed" | "rejected" | "no_match_available";
  matchedProjectName: string | null;
}

/** Buscador manual para la ficha del proyecto — para cuando el match automático (RUT/nombre) no encontró nada o encontró el proyecto equivocado. */
export async function searchPertinenciasForAssociation(query: string): Promise<PertinenciaSearchCandidate[]> {
  await requireAdmin();
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const { data, error } = await createSupabaseServiceClient()
    .from("pertinencia_consulta")
    .select("id, name, titular_name, correlative_id, estado, sub_estado, fecha_presentacion, match_status, matched_project:matched_project_id(name)")
    .or(`name.ilike.%${trimmed}%,titular_name.ilike.%${trimmed}%`)
    .order("fecha_presentacion", { ascending: false, nullsFirst: false })
    .limit(20);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const matched = row.matched_project as { name: string } | { name: string }[] | null;
    return {
      id: row.id,
      name: row.name,
      titularName: row.titular_name,
      correlativeId: row.correlative_id,
      estado: row.estado,
      subEstado: row.sub_estado,
      fechaPresentacion: row.fecha_presentacion,
      matchStatus: row.match_status,
      matchedProjectName: Array.isArray(matched) ? (matched[0]?.name ?? null) : (matched?.name ?? null),
    };
  });
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
  revalidatePath(`/proyectos/${projectId}`);
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
