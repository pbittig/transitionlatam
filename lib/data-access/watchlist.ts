import type { SupabaseClient } from "@supabase/supabase-js";

function isTerminalNegativeStatus(status: string | null | undefined): boolean {
  return ["rechazada", "rechazado", "desistida", "desistido"].includes(status?.trim().toLowerCase() ?? "");
}

export async function isProjectFollowed(client: SupabaseClient, projectId: string): Promise<boolean> {
  const { data } = await client
    .from("followed_project")
    .select("project_id, project:project_id(status)")
    .eq("project_id", projectId)
    .maybeSingle();
  const project = data?.project as unknown as { status: string | null } | null;
  return Boolean(data && !isTerminalNegativeStatus(project?.status));
}

export async function followProject(client: SupabaseClient, projectId: string): Promise<void> {
  const { data: project, error: projectError } = await client
    .from("project")
    .select("status")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError || !project) throw new Error("El proyecto ya no está disponible.");
  if (isTerminalNegativeStatus(project.status as string | null)) {
    throw new Error("No se puede seguir un proyecto rechazado o desistido.");
  }
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
  }).filter((project) => !isTerminalNegativeStatus(project.status));
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

export const NEW_PROJECT_ALERT_CATEGORIES = ["solar", "wind", "hydro", "other_renewable", "bess", "data_center"] as const;
export type NewProjectAlertCategory = (typeof NEW_PROJECT_ALERT_CATEGORIES)[number];

function newProjectCategory(row: Record<string, unknown>): NewProjectAlertCategory | null {
  const project = row.project as {
    name?: string;
    technology?: { code?: string } | null;
  } | null;
  const name = project?.name ?? "";
  const technologyCode = project?.technology?.code;
  if (/data\s*center|datacenter|centro\s+de\s+datos/i.test(name)) return "data_center";
  if (technologyCode === "bess" || /\bbess\b|bater[ií]a|almacenamiento|\bsae\b/i.test(name)) return "bess";
  if (technologyCode === "solar_pv") return "solar";
  if (technologyCode === "wind") return "wind";
  if (technologyCode === "hydro" || technologyCode === "pumped_hydro") return "hydro";
  if (["hybrid", "biomass", "geothermal"].includes(technologyCode ?? "")) return "other_renewable";
  return null;
}

/**
 * Eventos recientes de los proyectos en la lista de seguimiento, más nuevos primero.
 * Si `includeNewProjects` es true, también incluye eventos "announced" de cualquier
 * proyecto (no solo los seguidos), fusionados y ordenados junto con los de seguimiento.
 */
export async function getWatchlistEvents(
  client: SupabaseClient,
  limit = 30,
  includeNewProjects = false,
  newProjectCategories: readonly NewProjectAlertCategory[] = NEW_PROJECT_ALERT_CATEGORIES,
): Promise<WatchlistEvent[]> {
  const { data: followed } = await client.from("followed_project").select("project_id");
  const projectIds = (followed ?? []).map((r) => r.project_id as string);

  const selectCols = "id, project_id, event_type, occurred_at, description, project:project_id(name, status, technology:technology_id(code))";
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
  const hasActiveProject = (row: Record<string, unknown>) => {
    const project = row.project as { status?: string | null } | null;
    return !isTerminalNegativeStatus(project?.status);
  };
  const relevantFollowedEvents = (followedResult.data ?? []).filter((row) => hasActiveProject(row as Record<string, unknown>));
  const relevantNewProjects = (newProjectsResult.data ?? []).filter((row) => {
    const record = row as Record<string, unknown>;
    const category = newProjectCategory(record);
    return hasActiveProject(record) && category !== null && newProjectCategories.includes(category);
  });
  for (const row of [...relevantFollowedEvents, ...relevantNewProjects]) {
    const event = mapWatchlistEvent(row as Record<string, unknown>);
    merged.set(event.id, event);
  }
  return [...merged.values()].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, limit);
}

export async function getAppSetting(client: SupabaseClient, key: string, defaultValue = false): Promise<boolean> {
  const { data } = await client.from("app_setting").select("value").eq("key", key).maybeSingle();
  if (!data) return defaultValue;
  return data.value === true;
}

export async function setAppSetting(client: SupabaseClient, key: string, value: boolean): Promise<void> {
  const { error } = await client.from("app_setting").upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Error guardando configuración '${key}': ${error.message}`);
}
