import Link from "next/link";
import type { Metadata } from "next";
import { Activity, ArrowUpRight, BellRing, CalendarClock, FolderHeart, Leaf, PlugZap, Zap } from "lucide-react";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";
import { ModuleGuide } from "../components/ModuleGuide";
import { getIsFreeTier } from "@/lib/entitlements/isFreeTier";
import { getAppSetting, getFollowedProjects, getLatestEventsForProjects, getWatchlistEvents, NEW_PROJECT_ALERT_CATEGORIES } from "@/lib/data-access/watchlist";
import { getSeiaRecordsForProjects } from "@/lib/data-access/seia";
import { ThermalStatusBar } from "../components/ThermalStatusBar";
import { Panel } from "../components/Panel";
import { AppSettingToggle } from "../components/AppSettingToggle";
import { FollowButton } from "../proyectos/[id]/FollowButton";
import { PlanGate } from "../components/PlanGate";
import { NewProjectAlertSelector } from "../components/NewProjectAlertSelector";
import { getAppLocale } from "@/lib/i18n";
import { FreeFeaturePreview } from "../components/FreeFeaturePreview";
import { TrackingPreview } from "./TrackingPreview";

export const metadata: Metadata = { title: "Seguimiento" };
export const dynamic = "force-dynamic";

const EVENT_LABEL: Record<"es" | "en", Record<string, string>> = {
  es: { announced: "Solicitud ingresada", capacity_change: "Cambio de capacidad", ownership_change: "Cambio de propiedad", developer_change: "Cambio de desarrollador", connection_date_change: "Cambio de fecha de conexión", connection_point_change: "Cambio de punto de conexión", construction_date_change: "Cambio de fecha de construcción", status_change: "Cambio de estado", seia_milestone: "Hito ambiental", delay: "Retraso", other: "Actualización" },
  en: { announced: "Request added", capacity_change: "Capacity change", ownership_change: "Ownership change", developer_change: "Developer change", connection_date_change: "Connection date change", connection_point_change: "Connection point change", construction_date_change: "Construction date change", status_change: "Status change", seia_milestone: "Environmental milestone", delay: "Delay", other: "Update" },
};

export default async function AlertasPage() {
  const locale = await getAppLocale();
  const admin = await isAdmin();
  const serverClient = await createSupabaseServerClient();
  const profile = admin ? null : await getCurrentUserProfile(serverClient);

  // Sin sesión: pedir login (no hay plan que consultar). Con sesión pero plan
  // Free: se sigue mostrando esta misma página más abajo, con el contenido
  // bloqueado (PlanGate) — mismo criterio que /crm.
  if (!admin && !profile) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">{locale === "en" ? "Tracking" : "Seguimiento"}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{locale === "en" ? "Sign in to monitor projects and review updates." : "Inicia sesión para monitorear proyectos y ver sus novedades."}</p>
        <Link href="/ingresar" className="w-fit rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-50 dark:text-neutral-900">
          {locale === "en" ? "Sign in" : "Ingresar"}
        </Link>
      </div>
    );
  }

  const isFree = !admin && (await getIsFreeTier(serverClient));
  const client = createSupabaseServiceClient();
  const [followNotificationsEnabled, ...categorySettings] = await Promise.all([
    getAppSetting(client, "follow_notifications_enabled", true),
    ...NEW_PROJECT_ALERT_CATEGORIES.map((category) => getAppSetting(client, `notify_new_${category}`, true)),
  ]);
  const selectedCategories = NEW_PROJECT_ALERT_CATEGORIES.filter((_, index) => categorySettings[index]);
  const [followed, events] = await Promise.all([
    getFollowedProjects(client),
    getWatchlistEvents(client, 50, selectedCategories.length > 0, selectedCategories),
  ]);
  const recentEvents = events.length;
  const projectsWithMovement = new Set(events.map((event) => event.projectId)).size;
  const followedIds = followed.map((project) => project.projectId);
  const [seiaByProject, latestEventByProject] = await Promise.all([
    getSeiaRecordsForProjects(client, followedIds),
    getLatestEventsForProjects(client, followedIds),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-black via-[#272727] to-[#333333] px-6 py-9 text-white shadow-xl shadow-black/10 md:px-8 md:py-11">
        <span className="absolute -top-24 right-0 h-64 w-64 rounded-full border border-white/10" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{locale === "en" ? "Tracking" : "Seguimiento"}</h1>
          </div>
          <Link href="/proyectos" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-ink shadow-sm">
            {locale === "en" ? "Add projects to monitoring" : "Agregar proyectos al monitoreo"} <ArrowUpRight size={15} />
          </Link>
        </div>
      </section>

      <ModuleGuide
        purpose={locale === "en" ? "Continuously observe relevant projects and detect changes that may open a commercial window or change priorities." : "Mantener bajo observación continua los proyectos relevantes y detectar cambios que pueden abrir una ventana comercial o alterar una prioridad."}
        deliverables={locale === "en" ? ["Personal project radar", "History of changes and new milestones", "Alerts for status, dates, connection and SEIA"] : ["Radar personal de proyectos", "Historial de movimientos y nuevos hitos", "Alertas sobre estados, fechas, conexión y SEIA"]}
        howToUse={locale === "en" ? ["Add projects from their profile", "Configure relevant categories", "Review alerts and define a commercial action"] : ["Agregue proyectos al seguimiento desde su ficha", "Configure las categorías relevantes", "Revise las alertas y defina una acción comercial"]}
        plan="Prime"
        upgradeMessage={locale === "en" ? "Prime enables tracking, history and conversion of each signal into a CRM opportunity." : "Prime activa seguimiento e historial y permite convertir cada señal en una oportunidad dentro del CRM."}
        locale={locale}
      />

      <section className="grid gap-4 sm:grid-cols-3" aria-label={locale === "en" ? "Tracking summary" : "Resumen de monitoreo"}>
        <Panel className="border-neutral-200 p-4"><div className="flex items-center gap-2 text-xs font-medium text-neutral-500"><FolderHeart size={15} className="text-brand-primary" /> {locale === "en" ? "Followed projects" : "Proyectos seguidos"}</div><p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">{followed.length}</p><p className="text-sm text-neutral-500">{locale === "en" ? "your active radar" : "radar activo"}</p></Panel>
        <Panel className="border-neutral-200 p-4"><div className="flex items-center gap-2 text-xs font-medium text-neutral-500"><Activity size={15} className="text-brand-primary" /> {locale === "en" ? "Recent changes" : "Movimientos recientes"}</div><p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">{recentEvents}</p><p className="text-sm text-neutral-500">{locale === "en" ? "available in recent history" : "disponibles en el historial reciente"}</p></Panel>
        <Panel className="border-neutral-200 p-4"><div className="flex items-center gap-2 text-xs font-medium text-neutral-500"><BellRing size={15} className="text-brand-primary" /> {locale === "en" ? "Projects with updates" : "Proyectos con novedades"}</div><p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">{projectsWithMovement}</p><p className="text-sm text-neutral-500">{locale === "en" ? "require another review" : "requieren una nueva revisión"}</p></Panel>
      </section>

      {isFree && (
        <FreeFeaturePreview
          locale={locale}
          wide
          title={locale === "en" ? "See how a followed project is monitored" : "Así se monitorea un proyecto seguido"}
          description={locale === "en" ? "Each project brings its power, connection and environmental progress, plus the latest detected change into one view." : "Cada proyecto reúne su potencia, avance de conexión y ambiental, junto con el último cambio detectado."}
        >
          <TrackingPreview locale={locale} />
        </FreeFeaturePreview>
      )}

      <Panel className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
          <div>
            <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">{locale === "en" ? "Projects you follow" : "Proyectos que sigues"} ({followed.length})</h2>
            <p className="mt-1 text-sm text-neutral-500">{locale === "en" ? "Review the current status of projects in your radar." : "Consulte el estado actual de los proyectos incluidos en el radar."}</p>
          </div>
          <div className="flex flex-col items-start gap-2">
            <AppSettingToggle settingKey="follow_notifications_enabled" initiallyOn={followNotificationsEnabled} label={locale === "en" ? "Show tracking icon and pop-up alerts" : "Mostrar icono de seguimiento y avisos emergentes"} />
            <NewProjectAlertSelector initialSelection={[...selectedCategories]} locale={locale} />
          </div>
        </div>
        <PlanGate
          locked={isFree}
          variant="showcase"
          title={locale === "en" ? "Follow the projects that matter" : "Siga los proyectos relevantes"}
          description={locale === "en" ? "Create a custom radar and review relevant changes without searching project by project." : "Cree un radar personalizado y revise cambios relevantes sin volver a buscar proyecto por proyecto."}
          features={locale === "en" ? ["Custom project list", "Status and date changes", "Connection and SEIA updates", "Recent history in one view"] : ["Lista personalizada de proyectos", "Cambios de estado y fechas", "Novedades de conexión y SEIA", "Historial reciente en una sola vista"]}
        >
          {followed.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {locale === "en" ? "You are not following any projects yet. Open a project profile and select “Follow”." : <>Todavía no sigues ningún proyecto. Entra a la ficha de un proyecto y presiona &quot;Seguir&quot;.</>}
            </p>
          ) : (
            <ul className="grid gap-3 p-5 xl:grid-cols-2">
              {followed.map((f) => {
                const environmentalStatus = seiaByProject.get(f.projectId)?.status ?? null;
                const latestEvent = latestEventByProject.get(f.projectId);
                return (
                  <li key={f.projectId} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/proyectos/${f.projectId}`} className="block truncate font-semibold text-neutral-900 hover:underline dark:text-neutral-50">{f.projectName}</Link>
                        <p className="mt-1 text-xs text-neutral-400">{locale === "en" ? "Following since" : "Siguiendo desde"} {new Date(f.followedAt).toLocaleDateString(locale === "en" ? "en-US" : "es-CL")}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-brand-surface px-2 py-1 text-xs font-semibold text-brand-deep"><Zap size={13} />{f.capacityMw !== null ? `${new Intl.NumberFormat(locale === "en" ? "en-US" : "es-CL", { maximumFractionDigits: 1 }).format(f.capacityMw)} MW` : "— MW"}</span>
                        <FollowButton projectId={f.projectId} initiallyFollowed={true} locked={isFree} locale={locale} />
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500"><PlugZap size={14} />{locale === "en" ? "Connection status" : "Estado de conexión"}</div>
                        <div className="mt-2"><ThermalStatusBar status={f.status} compact showPercentage /></div>
                        <p className="mt-1 text-xs font-medium text-neutral-700 dark:text-neutral-200">{f.status ?? (locale === "en" ? "Not reported" : "No informado")}</p>
                      </div>
                      <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500"><Leaf size={14} />{locale === "en" ? "Environmental status" : "Estado ambiental"}</div>
                        <p className="mt-2 text-xs font-medium leading-5 text-neutral-700 dark:text-neutral-200">{environmentalStatus ?? (locale === "en" ? "No linked SEIA record" : "Sin expediente SEIA asociado")}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-start gap-2 border-t border-neutral-100 pt-3 text-xs dark:border-neutral-800">
                      <CalendarClock size={14} className="mt-0.5 shrink-0 text-neutral-400" />
                      {latestEvent ? (
                        <p className="text-neutral-600 dark:text-neutral-300"><span className="font-semibold">{locale === "en" ? "Latest change:" : "Último movimiento:"}</span> {EVENT_LABEL[locale][latestEvent.eventType] ?? latestEvent.eventType} · {new Date(latestEvent.occurredAt).toLocaleDateString(locale === "en" ? "en-US" : "es-CL")}</p>
                      ) : (
                        <p className="text-neutral-500">{locale === "en" ? "No recent changes detected." : "Sin movimientos recientes detectados."}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </PlanGate>
      </Panel>

    </div>
  );
}
