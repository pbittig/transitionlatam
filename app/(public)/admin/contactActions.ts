"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";

function revalidateProjectPages(projectId: string) {
  revalidatePath(`/admin/verificador/${projectId}`);
  revalidatePath(`/admin/editar-data/${projectId}`);
  revalidatePath(`/proyectos/${projectId}`);
}

/** Edita un campo de un contacto ya existente (auto-save desde ProjectContactsEditor). */
export async function updateContactField(
  projectId: string,
  personId: string,
  field: "name" | "email" | "phone",
  value: string | null,
): Promise<{ success: boolean; error?: string }> {
  if (!(await isAdmin())) {
    return { success: false, error: "Debes iniciar sesión como administrador." };
  }
  try {
    const client = createSupabaseServiceClient();
    const column = field === "name" ? "full_name" : field;
    const { error } = await client.from("person").update({ [column]: value }).eq("id", personId);
    if (error) throw new Error(error.message);
    revalidateProjectPages(projectId);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Crea un contacto y lo vincula directo a ESTE proyecto (entity_relationship
 * person->project, confidence_level "VERIFICADO" — un admin lo escribió a mano, no viene
 * de ninguna fuente automática, por eso sin data_source_id). Mismo criterio de alcance
 * por proyecto que ya usa getProjectStakeholders/load.ts para los contactos del Formulario.
 */
export async function addProjectContact(
  projectId: string,
  name: string,
  email: string | null,
  phone: string | null,
): Promise<{ success: boolean; error?: string; personId?: string }> {
  if (!(await isAdmin())) {
    return { success: false, error: "Debes iniciar sesión como administrador." };
  }
  const trimmedName = name.trim();
  if (!trimmedName) {
    return { success: false, error: "El nombre es obligatorio." };
  }
  try {
    const client = createSupabaseServiceClient();
    const { data: person, error: personError } = await client
      .from("person")
      .insert({ full_name: trimmedName, email: email?.trim() || null, phone: phone?.trim() || null })
      .select("id")
      .single();
    if (personError) throw new Error(personError.message);

    const { error: linkError } = await client.from("entity_relationship").insert({
      source_type: "person",
      source_id: person.id,
      relationship_type: "contacto",
      target_type: "project",
      target_id: projectId,
      confidence_level: "VERIFICADO",
    });
    if (linkError) throw new Error(linkError.message);

    revalidateProjectPages(projectId);
    return { success: true, personId: person.id as string };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/** Desvincula un contacto de este proyecto (no borra la persona — solo el vínculo person->project). */
export async function removeProjectContact(
  projectId: string,
  personId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!(await isAdmin())) {
    return { success: false, error: "Debes iniciar sesión como administrador." };
  }
  try {
    const client = createSupabaseServiceClient();
    const { error } = await client
      .from("entity_relationship")
      .delete()
      .eq("source_type", "person")
      .eq("source_id", personId)
      .eq("target_type", "project")
      .eq("target_id", projectId);
    if (error) throw new Error(error.message);
    revalidateProjectPages(projectId);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
