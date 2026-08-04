import Link from "next/link";
import type { Metadata } from "next";
import { Activity, ArrowUpRight, Bell, BellRing, CalendarClock, FolderHeart, Sparkles } from "lucide-react";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";
import { ModuleGuide } from "../components/ModuleGuide";
import { getIsFreeTier } from "@/lib/entitlements/isFreeTier";
import { getAppSetting, getFollowedProjects, getWatchlistEvents, NEW_PROJECT_ALERT_CATEGORIES } from "@/lib/data-access/watchlist";
import { ThermalStatusBar } from "../components/ThermalStatusBar";
import { Panel } from "../components/Panel";
import { AppSettingToggle } from "../components/AppSettingToggle";
import { FollowButton } from "../proyectos/[id]/FollowButton";
import { PlanGate } from "../components/PlanGate";
import { NewProjectAlertSelector } from "../components/NewProjectAlertSelector";
import { getUpcomingScheduleInputs } from "@/lib/data-access/pipeline";
import { computeScheduleForecast, FORECAST_PHASE_LABELS } from "@/lib/shared/scheduleForecast";
import type { PhaseKey } from "@/lib/shared/projectPhaseDurations";
import { getAppLocale } from "@/lib/i18n";

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

const PREDICTIVE_PHASES: Array<{ key: PhaseKey; label: string }> = [
  { key: "basica", label: "Ingeniería" },
  { key: "compras", label: "Compras" },
  { key: "construccion", label: "Construcción" },
];

const PREDICTIVE_TECH = [
  { key: "all", label: "Todas" },
  { key: "solar", label: "Solar" },
  { key: "wind", label: "Eólico" },
  { key: "bess", label: "BESS" },
  { key: "hybrid", label: "Híbridos" },
] as const;

export default async function AlertasPage({
  searchParams,
}: {
  searchParams: Promise<{ fase?: string; tecnologia?: string }>;
}) {
  const params = await searchParams;
  const locale = await getAppLocale();
  const selectedPhase = PREDICTIVE_PHASES.some((item) => item.key === params.fase)
    ? params.fase as PhaseKey
    : "compras";
  const selectedTechnology = PREDICTIVE_TECH.some((item) => item.key === params.tecnologia)
    ? params.tecnologia ?? "all"
    : "all";
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
  const [followed, events, scheduleInputs] = await Promise.all([
    getFollowedProjects(client),
    getWatchlistEvents(client, 50, selectedCategories.length > 0, selectedCategories),
    getUpcomingScheduleInputs(serverClient),
  ]);
  const predictiveInputs = scheduleInputs.filter((project) => {
    if (selectedTechnology === "all") return true;
    if (selectedTechnology === "bess") return project.includesStorage;
    if (selectedTechnology === "hybrid") return project.technologyCode === "hybrid";
    if (selectedTechnology === "solar") return project.technologyCode === "solar_pv";
    if (selectedTechnology === "wind") return project.technologyCode === "wind";
    return true;
  });
  const predictiveForecast = computeScheduleForecast(predictiveInputs, 0, 18);
  const predictiveEntries = predictiveForecast.milestoneCalendars
    .find((calendar) => calendar.phase === selectedPhase)?.entries.slice(0, 6) ?? [];
  const recentEvents = events.length;
  const projectsWithMovement = new Set(events.map((event) => event.projectId)).size;

  return (
    <div className="flex flex-col gap-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-black via-[#272727] to-[#333333] px-6 py-9 text-white shadow-xl shadow-black/10 md:px-8 md:py-11">
        <span className="absolute -top-24 right-0 h-64 w-64 rounded-full border border-white/10" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{locale === "en" ? "Tracking" : "Seguimiento"}</h1>
            <p className="mt-3 text-sm leading-6 text-white/75 md:text-base">
              {locale === "en" ? "Keep projects under continuous observation and receive alerts when their status, capacity, dates, connection, developer or environmental milestones change." : "Mantenga proyectos bajo observación continua y reciba avisos cuando cambien su estado, capacidad, fechas, conexión, desarrollador o hitos ambientales."}
            </p>
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

      <Panel className="overflow-hidden p-0">
        <div className="border-b border-neutral-100 px-5 py-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#333333] text-brand-primary">
              <Sparkles size={16} />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-neutral-950">{locale === "en" ? "Anticipate the next market window" : "Anticipa la próxima ventana del mercado"}</h2>
              <p className="mt-1 max-w-3xl text-sm text-neutral-500">
                {locale === "en" ? "See when projects are likely to enter Engineering, Procurement or Construction by technology." : "Observa cuándo los proyectos probablemente entrarán en Ingeniería, Compras o Construcción según tecnología."}
              </p>
            </div>
          </div>
        </div>
        <PlanGate
          locked={isFree}
          variant="showcase"
          title={locale === "en" ? "Enable predictive alerts" : "Activa alertas predictivas"}
          description={locale === "en" ? "Anticipate engineering, procurement and construction windows before the market moves." : "Anticipa ventanas de ingeniería, compras y construcción antes de que el mercado se mueva."}
          features={locale === "en" ? ["Stage selection", "Technology filters", "18-month estimated window", "Project count and capacity"] : ["Selección por etapa", "Filtros por tecnología", "Ventana estimada de 18 meses", "Capacidad y cantidad de proyectos"]}
        >
          <div className="space-y-5 p-5">
            <div>
              <p className="text-xs font-medium text-neutral-500">{locale === "en" ? "Stage to monitor" : "Etapa a monitorear"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PREDICTIVE_PHASES.map((phase) => (
                  <Link
                    key={phase.key}
                    href={`/monitoreo?fase=${phase.key}&tecnologia=${selectedTechnology}`}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      selectedPhase === phase.key
                        ? "border-[#333333] bg-[#333333] text-white"
                        : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400"
                    }`}
                  >
                    {locale === "en" ? (phase.key === "basica" ? "Engineering" : phase.key === "compras" ? "Procurement" : "Construction") : phase.label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500">{locale === "en" ? "Technology" : "Tecnología"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PREDICTIVE_TECH.map((technology) => (
                  <Link
                    key={technology.key}
                    href={`/monitoreo?fase=${selectedPhase}&tecnologia=${technology.key}`}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      selectedTechnology === technology.key
                        ? "border-brand-primary bg-brand-surface text-[#333333]"
                        : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400"
                    }`}
                  >
                    {locale === "en" ? (technology.key === "all" ? "All" : technology.key === "wind" ? "Wind" : technology.key === "hybrid" ? "Hybrid" : technology.label) : technology.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="grid gap-px overflow-hidden rounded-xl border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-3">
              {predictiveEntries.length === 0 ? (
                <p className="bg-white p-5 text-sm text-neutral-500 sm:col-span-2 lg:col-span-3">{locale === "en" ? "No estimated milestones for this combination over the next 18 months." : "No hay hitos estimados para esta combinación durante los próximos 18 meses."}</p>
              ) : predictiveEntries.map((entry) => (
                <article key={entry.yearMonth} className="bg-white p-4">
                  <p className="text-xs font-medium text-neutral-500">
                    {new Date(`${entry.yearMonth}-01T12:00:00`).toLocaleDateString(locale === "en" ? "en-US" : "es-CL", { month: "long", year: "numeric" })}
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">{entry.count}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {locale === "en" ? "projects" : "proyectos"} · {Math.round(entry.capacityMw).toLocaleString(locale === "en" ? "en-US" : "es-CL")} MW
                  </p>
                </article>
              ))}
            </div>
            <p className="text-[11px] leading-5 text-neutral-400">
              {FORECAST_PHASE_LABELS[selectedPhase]} estimado mediante el modelo de cronograma de Transition Latam; no corresponde a una fecha oficial publicada.
            </p>
          </div>
        </PlanGate>
      </Panel>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumen de monitoreo">
        <Panel className="border-neutral-200 p-4"><div className="flex items-center gap-2 text-xs font-medium text-neutral-500"><FolderHeart size={15} className="text-brand-primary" /> {locale === "en" ? "Followed projects" : "Proyectos seguidos"}</div><p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">{followed.length}</p><p className="text-sm text-neutral-500">{locale === "en" ? "your active radar" : "radar activo"}</p></Panel>
        <Panel className="border-neutral-200 p-4"><div className="flex items-center gap-2 text-xs font-medium text-neutral-500"><Activity size={15} className="text-brand-primary" /> {locale === "en" ? "Recent changes" : "Movimientos recientes"}</div><p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">{recentEvents}</p><p className="text-sm text-neutral-500">{locale === "en" ? "available in recent history" : "disponibles en el historial reciente"}</p></Panel>
        <Panel className="border-neutral-200 p-4"><div className="flex items-center gap-2 text-xs font-medium text-neutral-500"><BellRing size={15} className="text-brand-primary" /> {locale === "en" ? "Projects with updates" : "Proyectos con novedades"}</div><p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">{projectsWithMovement}</p><p className="text-sm text-neutral-500">{locale === "en" ? "require another review" : "requieren una nueva revisión"}</p></Panel>
      </section>

      <Panel className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
          <div>
            <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">{locale === "en" ? "Projects you follow" : "Proyectos que sigues"} ({followed.length})</h2>
            <p className="mt-1 text-sm text-neutral-500">{locale === "en" ? "Review the current status of projects in your radar." : "Consulte el estado actual de los proyectos incluidos en el radar."}</p>
          </div>
          <div className="flex flex-col items-start gap-2">
            <AppSettingToggle settingKey="follow_notifications_enabled" initiallyOn={followNotificationsEnabled} label="Mostrar campanita y avisos emergentes" />
            <NewProjectAlertSelector initialSelection={[...selectedCategories]} />
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
          <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">{locale === "en" ? "Detected changes" : "Movimientos detectados"}</h2>
          <p className="mt-1 text-sm text-neutral-500">{locale === "en" ? "Pop-up alerts disappear; this record remains available for review." : "Los avisos emergentes desaparecen; este registro queda disponible para consulta."}</p>
        </div>
        <PlanGate
          locked={isFree}
          variant="showcase"
          title={locale === "en" ? "Detect changes before your next conversation" : "Detecte cambios antes de su próxima conversación"}
          description={locale === "en" ? "The feed highlights milestones and commercial movements so your team can act with context and on time." : "El feed destaca hitos y movimientos comerciales para que su equipo pueda actuar con contexto y a tiempo."}
          features={locale === "en" ? ["Alerts ordered by date", "Identified project and change", "Event description", "Direct access to the profile"] : ["Alertas ordenadas por fecha", "Proyecto y cambio identificado", "Descripción del evento", "Acceso directo a la ficha"]}
        >
          {events.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{locale === "en" ? "No events yet for the projects you follow." : "Sin eventos todavía para los proyectos que sigues."}</p>
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
