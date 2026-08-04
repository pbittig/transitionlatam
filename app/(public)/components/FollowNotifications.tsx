"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCheck, Eye, X } from "lucide-react";
import type { WatchlistEvent } from "@/lib/data-access/watchlist";
import type { AppLocale } from "@/lib/i18n";

const EVENT_LABEL: Record<AppLocale, Record<string, string>> = {
  es: {
    announced: "Nuevo proyecto ingresado",
    capacity_change: "Cambió la capacidad",
    ownership_change: "Cambió la propiedad",
    developer_change: "Cambió el desarrollador",
    connection_date_change: "Cambió la fecha de conexión",
    connection_point_change: "Cambió el punto de conexión",
    construction_date_change: "Cambió la fecha de construcción",
    status_change: "Cambió el estado",
    seia_milestone: "Nuevo hito SEIA",
    delay: "Posible retraso",
    other: "Nueva actualización",
  },
  en: {
    announced: "New project added",
    capacity_change: "Capacity changed",
    ownership_change: "Ownership changed",
    developer_change: "Developer changed",
    connection_date_change: "Connection date changed",
    connection_point_change: "Connection point changed",
    construction_date_change: "Construction date changed",
    status_change: "Status changed",
    seia_milestone: "New SEIA milestone",
    delay: "Possible delay",
    other: "New update",
  },
};

const EVENT_DESCRIPTION_EN: Record<string, string> = {
  announced: "A new request was added to the public project pipeline.",
  capacity_change: "The project's recorded capacity was updated.",
  ownership_change: "The project's recorded ownership information was updated.",
  developer_change: "The project's recorded developer was updated.",
  connection_date_change: "The estimated connection date was updated.",
  connection_point_change: "The recorded connection point was updated.",
  construction_date_change: "The recorded construction date was updated.",
  status_change: "The request's recorded status was updated.",
  seia_milestone: "A new environmental assessment milestone was detected.",
  delay: "The available dates indicate a possible delay.",
  other: "New project information was detected.",
};

const LAST_SEEN_KEY = "transition-follow-last-seen";

function recentOnFirstVisit(event: WatchlistEvent): boolean {
  return Date.now() - new Date(event.occurredAt).getTime() < 48 * 60 * 60 * 1000;
}

export function FollowNotifications({ events, locale = "es" }: { events: WatchlistEvent[]; locale?: AppLocale }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState<WatchlistEvent[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const lastSeen = window.localStorage.getItem(LAST_SEEN_KEY);
    const unseen = lastSeen ? events.filter((event) => event.occurredAt > lastSeen) : events.filter(recentOnFirstVisit);
    const hydrationTimer = window.setTimeout(() => {
      setUnread(unseen.length);
      setToasts(unseen.slice(0, 3));
    }, 0);
    timers.current = unseen.slice(0, 3).map((event, index) => window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== event.id));
    }, 6500 + index * 900));
    return () => {
      window.clearTimeout(hydrationTimer);
      timers.current.forEach(window.clearTimeout);
    };
  }, [events]);

  function markAsSeen() {
    window.localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
    setUnread(0);
  }

  function toggleOpen() {
    setOpen((current) => {
      const next = !current;
      if (next) markAsSeen();
      return next;
    });
  }

  const eventDescription = (event: WatchlistEvent) => locale === "en"
    ? EVENT_DESCRIPTION_EN[event.eventType] ?? "New project information was detected."
    : event.description;

  return (
    <>
      <div className="relative">
        {open && (
          <div className="absolute right-0 bottom-full mb-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
              <div>
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">{locale === "en" ? "Tracking" : "Monitoreo"}</p>
                <p className="text-xs text-neutral-500">{locale === "en" ? "Latest detected changes" : "Últimos movimientos detectados"}</p>
              </div>
              <CheckCheck size={16} className="text-brand-primary" />
            </div>
            <div className="max-h-80 overflow-y-auto">
              {events.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <Eye size={20} className="mx-auto text-brand-primary" />
                  <p className="mt-2 text-sm font-medium text-neutral-800">{locale === "en" ? "No recent updates" : "Sin novedades recientes"}</p>
                  <p className="mt-1 text-xs text-neutral-500">{locale === "en" ? "You will receive a notification here when we detect a change." : "Recibirá una notificación aquí cuando detectemos un cambio."}</p>
                </div>
              ) : events.slice(0, 6).map((event) => (
                <Link key={event.id} href={`/proyectos/${event.projectId}`} onClick={() => setOpen(false)} className="block border-b border-neutral-100 px-4 py-3 transition last:border-0 hover:bg-brand-surface dark:border-neutral-800 dark:hover:bg-brand-primary/5">
                  <p className="text-xs font-semibold text-brand-deep dark:text-brand-primary">{EVENT_LABEL[locale][event.eventType] ?? event.eventType}</p>
                  <p className="mt-1 truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{event.projectName}</p>
                  <p className="mt-1 text-xs text-neutral-400">{new Date(event.occurredAt).toLocaleDateString(locale === "en" ? "en-US" : "es-CL")}</p>
                </Link>
              ))}
            </div>
            <Link href="/monitoreo" onClick={() => setOpen(false)} className="block bg-neutral-50 px-4 py-3 text-center text-xs font-semibold text-brand-deep hover:underline dark:bg-neutral-900 dark:text-brand-primary">
              {locale === "en" ? "View full history" : "Ver todo el historial"}
            </Link>
          </div>
        )}

        <button type="button" onClick={toggleOpen} aria-label={unread ? (locale === "en" ? `${unread} new alerts` : `${unread} alertas nuevas`) : (locale === "en" ? "Open tracking center" : "Abrir centro de monitoreo")} aria-expanded={open} className="relative flex h-11 w-11 items-center justify-center rounded-full border border-brand-primary/30 bg-white text-brand-deep shadow-lg shadow-brand-deep/10 transition hover:-translate-y-0.5 hover:border-brand-primary dark:bg-neutral-950 dark:text-brand-primary">
          <Eye size={19} />
          {unread > 0 && <span className="absolute -top-1 -right-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#333333] px-1 text-[10px] font-bold text-white ring-2 ring-white">{unread > 9 ? "9+" : unread}</span>}
        </button>
      </div>

      <div className="fixed top-20 right-4 z-30 flex w-[min(23rem,calc(100vw-2rem))] flex-col gap-2 print:hidden">
        {toasts.map((event) => (
          <div key={event.id} className="follow-toast rounded-2xl border border-brand-primary/25 bg-white p-4 shadow-xl shadow-brand-deep/10 dark:bg-neutral-950">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-surface text-brand-deep dark:bg-brand-primary/10 dark:text-brand-primary"><Eye size={15} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-brand-deep dark:text-brand-primary">{EVENT_LABEL[locale][event.eventType] ?? event.eventType}</p>
                <Link href={`/proyectos/${event.projectId}`} className="mt-1 block truncate text-sm font-semibold text-neutral-950 hover:underline dark:text-white">{event.projectName}</Link>
                {event.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{eventDescription(event)}</p>}
              </div>
              <button type="button" aria-label={locale === "en" ? "Close notification" : "Cerrar aviso"} onClick={() => setToasts((current) => current.filter((item) => item.id !== event.id))} className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"><X size={15} /></button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
