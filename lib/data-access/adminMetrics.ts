import type { SupabaseClient } from "@supabase/supabase-js";

export interface SignupDay {
  day: string; // YYYY-MM-DD
  count: number;
}

export interface MostViewedProject {
  id: string;
  name: string;
  internalCode: string;
  views: number;
}

export interface AdminActivityMetrics {
  totalUsers: number;
  activeUsersLast7Days: number;
  totalProjectViews: number;
  verifiedProjects: number;
  totalProjects: number;
  signupsByDay: SignupDay[];
  mostViewedProjects: MostViewedProject[];
}

export async function getAdminActivityMetrics(client: SupabaseClient): Promise<AdminActivityMetrics> {
  const { data, error } = await client.rpc("get_admin_activity_metrics");
  if (error) throw new Error(`Error obteniendo métricas de actividad: ${error.message}`);
  return data as AdminActivityMetrics;
}
