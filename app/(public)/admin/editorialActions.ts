"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";

export async function excludeEditorialProject(projectId: string): Promise<void> {
  if (!(await isAdmin())) throw new Error("No autorizado.");
  const { error } = await createSupabaseServiceClient()
    .from("project")
    .update({ editorial_status: "excluded", editorial_reviewed_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("editorial_status", "pending");
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/admin/trabajo-hoy");
}

