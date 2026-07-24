import type { SupabaseClient } from "@supabase/supabase-js";

export async function isProjectFollowed(client: SupabaseClient, projectId: string): Promise<boolean> {
  const { data } = await client.from("followed_project").select("project_id").eq("project_id", projectId).maybeSingle();
  return !!data;
}

export async function followProject(client: SupabaseClient, projectId: string): Promise<void> {
  const { error } = await client.from("followed_project").upsert({ project_id: projectId });
  if (error) throw new Error(`Error siguiendo proyecto: ${error.message}`);
}

export async function unfollowProject(client: SupabaseClient, projectId: string): Promise<void> {
  const { error } = await client.from("followed_project").delete().eq("project_id", projectId);
  if (error) throw new Error(`Error dejando de seguir proyecto: ${error.message}`);
}

export interface WatchlistEvent {
  id: string;
  projectId: string;
  projectName: string;
  eventType: string;
  occurredAt: string;
  description: string | null;
}

export interface FollowedProject {
  projectId: string;
  projectName: string;
  status: string | null;
  followedAt: string;
}

export async function getFollowedProjects(client: SupabaseClient): Promise<FollowedProject[]> {
  const { data, error } = await client
    .from("followed_project")
    .select("project_id, created_at, project:project_id(name, status)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Error obteniendo lista de seguimiento: ${error.message}`);

  return (data ?? []).map((r) => {
    const project = r.project as unknown as { name: string; status: string | null } | null;
    return {
      projectId: r.project_id as string,
      projectName: project?.name ?? "Proyecto eliminado",
      status: project?.status ?? null,
      followedAt: r.created_at as string,
    };
  });
}

function mapWatchlistEvent(r: Record<string, unknown>): WatchlistEvent {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    projectName: (r.project as unknown as { name: string } | null)?.name ?? "Proyecto",
    eventType: r.event_type as string,
    occurredAt: r.occurred_at as string,
    description: r.description as string | null,
  };
}

/**
 * Eventos recientes de los proyectos en la lista de seguimiento, más nuevos primero.
 * Si `includeNewProjects` es true, también incluye eventos "announced" de cualquier
 * proyecto (no solo los seguidos), fusionados y ordenados junto con los de seguimiento.
 */
export async function getWatchlistEvents(
  client: SupabaseClient,
  limit = 30,
  includeNewProjects = false
): Promise<WatchlistEvent[]> {
  const { data: followed } = await client.from("followed_project").select("project_id");
  const projectIds = (followed ?? []).map((r) => r.project_id as string);

  const selectCols = "id, project_id, event_type, occurred_at, description, project:project_id(name)";
  const [followedResult, newProjectsResult] = await Promise.all([
    projectIds.length > 0
      ? client.from("project_event").select(selectCols).in("project_id", projectIds).order("occurred_at", { ascending: false }).limit(limit)
      : Promise.resolve({ data: [], error: null }),
    includeNewProjects
      ? client.from("project_event").select(selectCols).eq("event_type", "announced").order("occurred_at", { ascending: false }).limit(limit)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (followedResult.error) throw new Error(`Error obteniendo eventos de seguimiento: ${followedResult.error.message}`);
  if (newProjectsResult.error) throw new Error(`Error obteniendo proyectos nuevos: ${newProjectsResult.error.message}`);

  const merged = new Map<string, WatchlistEvent>();
  for (const row of [...(followedResult.data ?? []), ...(newProjectsResult.data ?? [])]) {
    const event = mapWatchlistEvent(row as Record<string, unknown>);
    merged.set(event.id, event);
  }
  return [...merged.values()].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, limit);
}

export async function getAppSetting(client: SupabaseClient, key: string): Promise<boolean> {
  const { data } = await client.from("app_setting").select("value").eq("key", key).maybeSingle();
  return data?.value === true;
}

export async function setAppSetting(client: SupabaseClient, key: string, value: boolean): Promise<void> {
  const { error } = await client.from("app_setting").upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Error guardando configuración '${key}': ${error.message}`);
}
