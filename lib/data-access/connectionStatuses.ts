import type { SupabaseClient } from "@supabase/supabase-js";

export interface ConnectionStatusOption {
  code: string;
  label: string;
}

/** Vocabulario de estados de solicitud (17 valores sembrados en connection_status) — usado para el <select> de estado en los formularios de edición admin. */
export async function getConnectionStatuses(client: SupabaseClient): Promise<ConnectionStatusOption[]> {
  const { data, error } = await client
    .from("connection_status")
    .select("code, label")
    .order("label", { ascending: true });
  if (error) throw new Error(`Error obteniendo estados de conexión: ${error.message}`);
  return (data ?? []).map((row) => ({ code: row.code as string, label: row.label as string }));
}
