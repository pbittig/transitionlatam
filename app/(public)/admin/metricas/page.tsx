import type { Metadata } from "next";
import { Users, Activity, Eye, ShieldCheck, FolderKanban } from "lucide-react";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { getAdminActivityMetrics } from "@/lib/data-access/adminMetrics";
import { listAdminUsers } from "@/lib/data-access/adminUsers";
import { Panel } from "../../components/Panel";
import { SignupsLineChart } from "./SignupsLineChart";
import { MostViewedBarChart } from "./MostViewedBarChart";

export const metadata: Metadata = { title: "Métricas · Admin" };
export const dynamic = "force-dynamic";

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Panel className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">{value}</p>
    </Panel>
  );
}

export default async function AdminMetricsPage() {
  if (!(await isAdmin())) return null;

  const client = createSupabaseServiceClient();
  const [metrics, users] = await Promise.all([getAdminActivityMetrics(client), listAdminUsers()]);

  const recentSignups = [...users].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10);
  const recentActive = [...users]
    .filter((u) => u.lastSignInAt)
    .sort((a, b) => (b.lastSignInAt as string).localeCompare(a.lastSignInAt as string))
    .slice(0, 10);

  const verifiedPct = metrics.totalProjects > 0 ? Math.round((metrics.verifiedProjects / metrics.totalProjects) * 100) : 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Métricas</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">Actividad de usuarios y uso de la plataforma.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={<Users size={14} />} label="Usuarios registrados" value={users.length.toLocaleString("es-CL")} />
        <StatTile icon={<Activity size={14} />} label="Activos últimos 7 días" value={metrics.activeUsersLast7Days.toLocaleString("es-CL")} />
        <StatTile icon={<Eye size={14} />} label="Vistas de proyecto (total)" value={metrics.totalProjectViews.toLocaleString("es-CL")} />
        <StatTile icon={<ShieldCheck size={14} />} label="Cartera verificada" value={`${verifiedPct}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Registros por día</h2>
          <div className="mt-3">
            <SignupsLineChart signupsByDay={metrics.signupsByDay} />
          </div>
        </Panel>
        <Panel>
          <div className="flex items-center gap-2">
            <FolderKanban size={15} className="text-neutral-400" />
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Proyectos más visitados</h2>
          </div>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Últimos 90 días.</p>
          <div className="mt-3">
            <MostViewedBarChart projects={metrics.mostViewedProjects} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="overflow-hidden p-0">
          <h2 className="px-4 pt-4 text-sm font-semibold text-neutral-900 dark:text-neutral-50">Últimos usuarios registrados</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-t border-neutral-100 bg-neutral-50 text-left text-xs text-neutral-500 dark:border-neutral-900 dark:bg-neutral-900/50">
                <tr>
                  <th className="px-4 py-2 font-medium">Usuario</th>
                  <th className="px-4 py-2 font-medium">Registrado</th>
                </tr>
              </thead>
              <tbody>
                {recentSignups.map((user) => (
                  <tr key={user.id} className="border-t border-neutral-100 dark:border-neutral-900">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-neutral-800 dark:text-neutral-200">{user.fullName || user.email}</div>
                      <div className="text-xs text-neutral-500">{user.email}</div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-neutral-500">{new Date(user.createdAt).toLocaleDateString("es-CL")}</td>
                  </tr>
                ))}
                {recentSignups.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-4 text-center text-neutral-400">Sin registros todavía.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="overflow-hidden p-0">
          <h2 className="px-4 pt-4 text-sm font-semibold text-neutral-900 dark:text-neutral-50">Últimos usuarios con actividad</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-t border-neutral-100 bg-neutral-50 text-left text-xs text-neutral-500 dark:border-neutral-900 dark:bg-neutral-900/50">
                <tr>
                  <th className="px-4 py-2 font-medium">Usuario</th>
                  <th className="px-4 py-2 font-medium">Último acceso</th>
                </tr>
              </thead>
              <tbody>
                {recentActive.map((user) => (
                  <tr key={user.id} className="border-t border-neutral-100 dark:border-neutral-900">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-neutral-800 dark:text-neutral-200">{user.fullName || user.email}</div>
                      <div className="text-xs text-neutral-500">{user.email}</div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-neutral-500">{new Date(user.lastSignInAt as string).toLocaleString("es-CL")}</td>
                  </tr>
                ))}
                {recentActive.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-4 text-center text-neutral-400">Sin actividad registrada todavía.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
