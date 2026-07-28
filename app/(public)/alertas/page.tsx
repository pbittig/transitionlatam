import Link from "next/link";
import type { Metadata } from "next";
import { Activity, ArrowUpRight, Bell, BellRing, CalendarClock, FolderHeart, Radar } from "lucide-react";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";
import { getIsFreeTier } from "@/lib/entitlements/isFreeTier";
import { getAppSetting, getFollowedProjects, getWatchlistEvents } from "@/lib/data-access/watchlist";
import { ThermalStatusBar } from "../components/ThermalStatusBar";
import { Panel } from "../components/Panel";
import { AppSettingToggle } from "../components/AppSettingToggle";
import { FollowButton } from "../proyectos/[id]/FollowButton";
import { PlanGate } from "../components/PlanGate";

export const metadata: Metadata = { title: "Seguimiento" };
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
  const serverClient = await createSupabaseServerClient();
  const profile = admin ? null : await getCurrentUserProfile(serverClient);

  // Sin sesión: pedir login (no hay plan que consultar). Con sesión pero plan
  // Free: se sigue mostrando esta misma página más abajo, con el contenido
  // bloqueado (PlanGate) — mismo criterio que /crm.
  if (!admin && !profile) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Alertas</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Inicia sesión para seguir proyectos y ver sus novedades.
        </p>
        <Link href="/login" className="w-fit rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-50 dark:text-neutral-900">
          Ingresar
        </Link>
      </div>
    );
  }

  const isFree = !admin && (await getIsFreeTier(serverClient));
  const client = createSupabaseServiceClient();
  const [notifyNewProjects, followNotificationsEnabled] = await Promise.all([
    getAppSetting(client, "notify_new_projects"),
    getAppSetting(client, "follow_notifications_enabled", true),
  ]);
  const [followed, events] = await Promise.all([
    getFollowedProjects(client),
    getWatchlistEvents(client, 50, notifyNewProjects),
  ]);
  const recentEvents = events.length;
  const projectsWithMovement = new Set(events.map((event) => event.projectId)).size;

  return (
    <div className="flex flex-col gap-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-ink via-brand-deep to-[#1b8d83] px-6 py-9 text-white shadow-xl shadow-brand-deep/10 md:px-8 md:py-11">
        <span className="absolute -top-24 right-0 h-64 w-64 rounded-full border border-white/10" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-brand-primary uppercase"><Radar size={14} /> Radar personalizado</div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">Seguimiento</h1>
            <p className="mt-3 text-sm leading-6 text-white/75 md:text-base">
              Recibe avisos cuando se muevan los proyectos que seleccionaste: cambios de estado, capacidad, fechas, conexión, desarrollador o hitos ambientales.
            </p>
          </div>
          <Link href="/proyectos-esperados" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-ink shadow-sm">
            Buscar proyectos para seguir <ArrowUpRight size={15} />
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumen de seguimiento">
        <Panel className="border-t-2 border-t-brand-primary p-4"><div className="flex items-center gap-2 text-xs font-medium text-neutral-500"><FolderHeart size={15} /> Proyectos seguidos</div><p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">{followed.length}</p><p className="text-sm text-neutral-500">tu radar activo</p></Panel>
        <Panel className="border-t-2 border-t-blue-400 p-4"><div className="flex items-center gap-2 text-xs font-medium text-neutral-500"><Activity size={15} /> Movimientos recientes</div><p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">{recentEvents}</p><p className="text-sm text-neutral-500">disponibles en el historial reciente</p></Panel>
        <Panel className="border-t-2 border-t-amber-400 p-4"><div className="flex items-center gap-2 text-xs font-medium text-neutral-500"><BellRing size={15} /> Proyectos con novedades</div><p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">{projectsWithMovement}</p><p className="text-sm text-neutral-500">requieren una nueva revisión</p></Panel>
      </section>

      <Panel className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
          <div>
            <p className="text-xs font-semibold tracking-wide text-brand-deep uppercase dark:text-brand-primary">Tu selección</p>
            <h2 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">Proyectos que sigues ({followed.length})</h2>
          </div>
          <div className="flex flex-col items-start gap-2">
            <AppSettingToggle settingKey="follow_notifications_enabled" initiallyOn={followNotificationsEnabled} label="Mostrar campanita y avisos emergentes" />
            <AppSettingToggle settingKey="notify_new_projects" initiallyOn={notifyNewProjects} label="Avisarme también de nuevos proyectos renovables, BESS y data centers" />
          </div>
        </div>
        <PlanGate
          locked={isFree}
          variant="showcase"
          title="Sigue los proyectos que importan"
          description="Crea tu radar personalizado y revisa cambios relevantes sin volver a buscar proyecto por proyecto."
          features={["Lista personalizada de proyectos", "Cambios de estado y fechas", "Novedades de conexión y SEIA", "Historial reciente en una sola vista"]}
        >
          {followed.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Todavía no sigues ningún proyecto. Entra a la ficha de un proyecto y presiona &quot;Seguir&quot;.
            </p>
          ) : (
            <ul className="grid gap-3 p-5 md:grid-cols-2">
              {followed.map((f) => (
                <li key={f.projectId} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
                  <div className="min-w-0">
                    <Link href={`/proyectos/${f.projectId}`} className="block truncate font-medium text-neutral-900 hover:underline dark:text-neutral-50">{f.projectName}</Link>
                    <p className="mt-1 text-xs text-neutral-400">Siguiendo desde {new Date(f.followedAt).toLocaleDateString("es-CL")}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <ThermalStatusBar status={f.status} compact />
                    <FollowButton projectId={f.projectId} initiallyFollowed={true} locked={isFree} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PlanGate>
      </Panel>

      <Panel className="overflow-hidden p-0">
        <div className="border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
          <p className="text-xs font-semibold tracking-wide text-brand-deep uppercase dark:text-brand-primary">Historial permanente</p>
          <h2 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">Movimientos detectados</h2>
          <p className="mt-1 text-sm text-neutral-500">Los avisos emergentes desaparecen; este registro queda disponible para consulta.</p>
        </div>
        <PlanGate
          locked={isFree}
          variant="showcase"
          title="Detecta cambios antes de tu próxima conversación"
          description="El feed destaca hitos y movimientos comerciales para que tu equipo pueda actuar con contexto y a tiempo."
          features={["Alertas ordenadas por fecha", "Proyecto y cambio identificado", "Descripción del evento", "Acceso directo a la ficha"]}
        >
          {events.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin eventos todavía para los proyectos que sigues.</p>
          ) : (
            <ol className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3 px-5 py-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-surface text-brand-deep dark:bg-brand-primary/10 dark:text-brand-primary"><Bell size={15} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{EVENT_LABEL[e.eventType] ?? e.eventType}</div>
                      <div className="flex items-center gap-1 text-xs text-neutral-400"><CalendarClock size={12} /> {new Date(e.occurredAt).toLocaleDateString("es-CL")}</div>
                    </div>
                    <Link href={`/proyectos/${e.projectId}`} className="mt-1 block text-sm font-medium text-brand-deep hover:underline dark:text-brand-primary">{e.projectName}</Link>
                    {e.description && <div className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-400">{e.description}</div>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </PlanGate>
      </Panel>
    </div>
  );
}
