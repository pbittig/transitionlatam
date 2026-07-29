import type { SupabaseClient } from "@supabase/supabase-js";

export type EditorialQueueItem = {
  id: string;
  name: string;
  internalCode: string;
  externalReference: string | null;
  detectedAt: string;
  receivedAt: string | null;
  category: string | null;
  prefilterStatus: string | null;
  prefilterReason: string | null;
  preverified: boolean;
  verified: boolean;
};

type EditorialRow = {
  id: string;
  name: string;
  internal_code: string;
  external_reference: string | null;
  detected_at: string | null;
  created_at: string;
  prefilter_category: string | null;
  prefilter_status: string | null;
  prefilter_reason: string | null;
  verified_at: string | null;
};

export async function getEditorialQueue(
  client: SupabaseClient,
  scope: "today" | "backlog",
  limit = 100,
): Promise<EditorialQueueItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  let query = client
    .from("project")
    .select(
      "id,name,internal_code,external_reference,detected_at,created_at,prefilter_category,prefilter_status,prefilter_reason,verified_at",
    )
    .eq("editorial_status", "pending")
    .neq("prefilter_status", "out_of_scope");

  query =
    scope === "today"
      ? query.gte("detected_at", `${today}T00:00:00.000Z`).order("detected_at", { ascending: false })
      : query.lt("detected_at", `${today}T00:00:00.000Z`).order("detected_at", { ascending: false });

  const { data, error } = await query.limit(limit);
  if (error) throw new Error(`No se pudo cargar la bandeja editorial: ${error.message}`);
  const rows = (data ?? []) as EditorialRow[];
  const ids = rows.map((row) => row.id);
  const { data: preverificationRows, error: preverificationError } = ids.length
    ? await client
        .from("project_preverification")
        .select("project_id")
        .in("project_id", ids)
        .in("status", ["completed", "partial"])
    : { data: [], error: null };
  if (preverificationError) throw new Error(`No se pudo leer la pre-verificación: ${preverificationError.message}`);
  const preverifiedIds = new Set((preverificationRows ?? []).map((row) => row.project_id as string));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    internalCode: row.internal_code,
    externalReference: row.external_reference,
    detectedAt: row.detected_at ?? row.created_at,
    receivedAt: null,
    category: row.prefilter_category,
    prefilterStatus: row.prefilter_status,
    prefilterReason: row.prefilter_reason,
    preverified: preverifiedIds.has(row.id),
    verified: !!row.verified_at,
  }));
}

export async function getEditorialCounts(client: SupabaseClient): Promise<{
  today: number;
  backlog: number;
  outOfScope: number;
}> {
  const today = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
  const [todayResult, backlogResult, excludedResult] = await Promise.all([
    client
      .from("project")
      .select("id", { count: "exact", head: true })
      .eq("editorial_status", "pending")
      .neq("prefilter_status", "out_of_scope")
      .gte("detected_at", today),
    client
      .from("project")
      .select("id", { count: "exact", head: true })
      .eq("editorial_status", "pending")
      .neq("prefilter_status", "out_of_scope")
      .lt("detected_at", today),
    client
      .from("project")
      .select("id", { count: "exact", head: true })
      .eq("editorial_status", "pending")
      .eq("prefilter_status", "out_of_scope"),
  ]);
  for (const result of [todayResult, backlogResult, excludedResult]) {
    if (result.error) throw new Error(`No se pudo contar la bandeja editorial: ${result.error.message}`);
  }
  return {
    today: todayResult.count ?? 0,
    backlog: backlogResult.count ?? 0,
    outOfScope: excludedResult.count ?? 0,
  };
}

