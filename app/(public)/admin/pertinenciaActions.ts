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

/**
 * Suelta la pertinencia que está colgada de un proyecto: la asociación estaba mal.
 *
 * Es el equivalente de `unassignSeiaMatch` para el otro trámite. Hasta ahora,
 * desde la ficha se podía asociar y corregir una pertinencia, pero no quitarla:
 * si estaba mal asociada, la única salida era buscarle otra, y para una ficha
 * cuya pertinencia correcta no existe eso obligaba a dejar el dato equivocado.
 *
 * VUELVE A `pending` Y SIN SUGERENCIA, no a `rejected`. Son cosas distintas:
 * `rejected` dice "la sugerencia automática estaba mal", y acá lo que estaba
 * mal es una confirmación humana. Dejarla pendiente la devuelve a la cola de
 * /admin/pertinencias para que alguien le busque su proyecto de verdad; borrar
 * la sugerencia evita que el próximo que la mire vuelva a confirmar el mismo
 * error con un clic.
 *
 * No marca "este proyecto no tiene pertinencia": no lo sabemos. Una corrida
 * futura del matcher puede volver a proponerle una — mismo criterio que dejó
 * escrito `unassignSeiaMatch`.
 */
export async function unassignPertinenciaFromProject(projectId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    const { error } = await createSupabaseServiceClient()
      .from("pertinencia_consulta")
      .update({
        match_status: "pending",
        matched_project_id: null,
        suggested_project_id: null,
        suggested_match_score: null,
        // Se limpia el rastro de la confirmación que se está deshaciendo. Dejar
        // quién y cuándo confirmó junto a un match_status "pending" describiría
        // un estado que no existe, y el próximo que lo lea va a creer que hay
        // una confirmación humana detrás de una fila que nadie confirmó.
        match_confirmed_by: null,
        match_confirmed_at: null,
      })
      .eq("matched_project_id", projectId)
      .eq("match_status", "confirmed");
    if (error) throw new Error(error.message);

    revalidatePath(`/admin/verificador/${projectId}`);
    revalidatePath(`/admin/editar-data/${projectId}`);
    revalidatePath(`/proyectos/${projectId}`);
    revalidatePath("/admin/pertinencias");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
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
