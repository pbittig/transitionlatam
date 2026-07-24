import Link from "next/link";
import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { getAppSetting, getFollowedProjects, getWatchlistEvents } from "@/lib/data-access/watchlist";
import { ThermalStatusBar } from "../components/ThermalStatusBar";
import { Panel } from "../components/Panel";
import { AppSettingToggle } from "../components/AppSettingToggle";
import { FollowButton } from "../proyectos/[id]/FollowButton";

export const metadata: Metadata = { title: "Alertas" };
export const dynamic = "force-dynamic";

const EVENT_LABEL: Record<string, string> = {
  announced: "Solicitud ingresada",
  capacity_change: "Cambio de capacidad",
  ownership_change: "Cambio de propiedad",
  developer_change: "Cambio de desarrollador",
  connection_date_change: "Cambio de fecha de conexión",
  connection_point_change: "Cambio de punto de conexión",
  construction_date_change: "Cambio de fecha de construcción",
  status_change: "Cambio de estado",
  seia_milestone: "Hito SEIA",
  delay: "Retraso",
  other: "Otro",
};

export default async function AlertasPage() {
  const admin = await isAdmin();

  if (!admin) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Alertas</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Esta sección es solo para administradores — inicia sesión para seguir proyectos y ver sus novedades.
        </p>
        <Link href="/login" className="w-fit rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-50 dark:text-neutral-900">
          Ingresar
        </Link>
      </div>
    );
  }

  const client = createSupabaseServiceClient();
  const notifyNewProjects = await getAppSetting(client, "notify_new_projects");
  const [followed, events] = await Promise.all([
    getFollowedProjects(client),
    getWatchlistEvents(client, 50, notifyNewProjects),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Alertas</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Novedades de los proyectos que sigues — sigue un proyecto desde su ficha (botón &quot;Seguir&quot;).
        </p>
        <div className="mt-3">
          <AppSettingToggle settingKey="notify_new_projects" initiallyOn={notifyNewProjects} label="Avisarme de proyectos nuevos" />
        </div>
      </div>

      <Panel>
        <h2 className="mb-4 text-sm font-medium text-neutral-500 dark:text-neutral-400">
          Proyectos que sigues ({followed.length})
        </h2>
        {followed.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Todavía no sigues ningún proyecto. Entra a la ficha de un proyecto y presiona &quot;Seguir&quot;.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {followed.map((f) => (
              <li key={f.projectId} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                <Link href={`/proyectos/${f.projectId}`} className="font-medium text-neutral-900 hover:underline dark:text-neutral-50">
                  {f.projectName}
                </Link>
                <div className="flex items-center gap-3">
                  <ThermalStatusBar status={f.status} compact />
                  <FollowButton projectId={f.projectId} initiallyFollowed={true} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Esto te avisa cuando: cambia el estado de una solicitud que sigues, se asigna o cambia
        su punto de conexión, cambia su fecha estimada de conexión, o hay novedades en su
        evaluación ambiental (SEIA) — y, si activaste el switch de arriba, cuando entra
        cualquier proyecto nuevo a Acceso Abierto.
      </p>

      <Panel>
        <h2 className="mb-4 text-sm font-medium text-neutral-500 dark:text-neutral-400">Novedades recientes</h2>
        {events.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin eventos todavía para los proyectos que sigues.</p>
        ) : (
          <ol className="flex flex-col gap-4 border-l border-neutral-200 pl-4 dark:border-neutral-800">
            {events.map((e) => (
              <li key={e.id}>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  {new Date(e.occurredAt).toLocaleDateString("es-CL")} ·{" "}
                  <Link href={`/proyectos/${e.projectId}`} className="hover:underline">
                    {e.projectName}
                  </Link>
                </div>
                <div className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
                  {EVENT_LABEL[e.eventType] ?? e.eventType}
                </div>
                {e.description && <div className="text-sm text-neutral-600 dark:text-neutral-400">{e.description}</div>}
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
