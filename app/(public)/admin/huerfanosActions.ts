"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";

/** Quita un vínculo suelto. No toca las puntas: la que sigue viva queda igual. */
export async function quitarVinculoHuerfano(id: string): Promise<{ success: boolean; error?: string }> {
  if (!(await isAdmin())) return { success: false, error: "Debes iniciar sesión como administrador." };
  const { error } = await createSupabaseServiceClient().from("entity_relationship").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/huerfanos");
  revalidatePath("/admin");
  return { success: true };
}

/**
 * Reapunta un vínculo huérfano a una empresa que sí existe.
 *
 * Solo para los que perdieron la empresa: los que perdieron el proyecto no
 * tienen a qué reapuntar y por eso la página no ofrece esta acción ahí.
 */
export async function reasignarVinculoAEmpresa(
  id: string,
  companyId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!(await isAdmin())) return { success: false, error: "Debes iniciar sesión como administrador." };
  const client = createSupabaseServiceClient();

  // Se comprueba que la empresa exista antes de escribir: `entity_relationship`
  // no tiene llave foránea en estas columnas, así que la base aceptaría
  // cualquier uuid y el vínculo quedaría huérfano de nuevo — esta vez por
  // nuestra mano.
  const { data: empresa, error: buscarError } = await client.from("company").select("id").eq("id", companyId).maybeSingle();
  if (buscarError) return { success: false, error: buscarError.message };
  if (!empresa) return { success: false, error: "Esa empresa no existe." };

  const { error } = await client
    .from("entity_relationship")
    .update({ target_type: "company", target_id: companyId })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/huerfanos");
  return { success: true };
}

/**
 * Borra de una vez los vínculos cuyo proyecto ya no existe.
 *
 * Se recalculan acá en vez de recibir la lista desde el navegador: así el
 * borrado alcanza exactamente a lo que hoy está huérfano, y un id que dejó de
 * serlo entre la carga de la página y el clic no se toca.
 */
export async function quitarVinculosDeProyectosBorrados(): Promise<{ success: boolean; borrados?: number; error?: string }> {
  if (!(await isAdmin())) return { success: false, error: "Debes iniciar sesión como administrador." };
  const client = createSupabaseServiceClient();
  const { data, error } = await client.rpc("delete_orphan_relationships_of_deleted_projects");
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/huerfanos");
  revalidatePath("/admin");
  return { success: true, borrados: (data as number) ?? 0 };
}

export interface EmpresaCandidata {
  id: string;
  name: string;
  rut: string | null;
}

/** Busca empresas por nombre o RUT para el selector de reasignación. */
export async function buscarEmpresas(query: string): Promise<EmpresaCandidata[]> {
  if (!(await isAdmin())) return [];
  const q = query.trim();
  if (q.length < 3) return [];
  const { data, error } = await createSupabaseServiceClient()
    .from("company")
    .select("id, name, rut")
    .or(`name.ilike.%${q}%,rut.ilike.%${q}%`)
    .order("name")
    .limit(10);
  if (error) return [];
  return (data ?? []) as EmpresaCandidata[];
}
