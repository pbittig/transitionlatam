"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { startReverificationPass } from "@/lib/data-access/reverificationPass";

/**
 * Empieza una vuelta nueva de repaso: todo lo verificado hasta este instante
 * vuelve a la cola.
 *
 * No borra ni cambia ninguna ficha — solo mueve la fecha de corte. Por eso es
 * seguro apretarlo por error: lo peor que pasa es que la cola de repaso se
 * llene de nuevo, y volver atrás es re-verificar o iniciar otra vuelta.
 */
export async function iniciarRepaso(): Promise<void> {
  // Devuelve void y lanza en caso de error, igual que reverificationActions.ts:
  // así se puede usar directo como `action` de un <form> sin envoltorio.
  if (!(await isAdmin())) throw new Error("No autorizado.");
  await startReverificationPass(createSupabaseServiceClient());
  revalidatePath("/admin/verificador");
}
