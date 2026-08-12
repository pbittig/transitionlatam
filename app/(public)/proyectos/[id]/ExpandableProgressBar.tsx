"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { AppLocale } from "@/lib/i18n";

export function ExpandableProgressBar({
  title,
  status,
  percentage,
  badgeLabel,
  terminal = false,
  noData = false,
  expected,
  detail,
  locale,
}: {
  title: string;
  status: string;
  percentage: number | null;
  badgeLabel: string;
  terminal?: boolean;
  noData?: boolean;
  /**
   * Marca de referencia sobre la misma barra (0-100) con su pie de nota — hoy
   * la usa el avance de construcción para mostrar dónde debería ir el proyecto
   * según el modelo, junto al avance real que reporta el titular.
   */
  expected?: { percent: number; label: string } | null;
  detail: ReactNode;
  locale: AppLocale;
}) {
  const [open, setOpen] = useState(false);
  const width = percentage ?? 0;
  const showExpected = !!expected && !terminal && !noData && percentage !== null;

  return (
    <div
      className={
        noData
          ? "rounded-2xl border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/40"
          : "rounded-2xl border border-brand-primary/25 bg-gradient-to-r from-brand-surface/80 via-white to-white p-5 shadow-sm dark:from-brand-primary/10 dark:via-neutral-950 dark:to-neutral-950"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-brand-ink dark:text-white">{title}</h3>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{status}</p>
        </div>
        <span
          className={
            terminal || noData
              ? "rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
              : "rounded-full bg-brand-primary/15 px-2.5 py-1 text-xs font-semibold text-brand-deep dark:bg-brand-primary/20 dark:text-brand-primary"
          }
        >
          {badgeLabel}
        </span>
      </div>

      {/* `relative` para poder anclar la marca de referencia; sin overflow-hidden
          en el contenedor externo, así la marca puede sobresalir de la barra. */}
      <div className="relative mt-4">
        <div
          className={`h-3 w-full overflow-hidden rounded-full ${
            noData ? "bg-neutral-200 dark:bg-neutral-800" : "bg-brand-primary/15 ring-1 ring-brand-primary/10 dark:bg-brand-primary/10"
          }`}
          role="progressbar"
          aria-label={`${title}: ${badgeLabel}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage ?? undefined}
        >
          {!terminal && !noData && percentage !== null && (
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#333333] to-brand-primary shadow-[0_0_14px_rgba(56,215,197,0.28)] transition-[width]"
              style={{ width: `${width}%` }}
            />
          )}
        </div>
        {showExpected && (
          <span
            aria-hidden
            className="pointer-events-none absolute -top-1 -bottom-1 w-0.5 rounded-full bg-neutral-500 dark:bg-neutral-400"
            style={{ left: `calc(${Math.min(100, Math.max(0, expected!.percent))}% - 1px)` }}
          />
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-neutral-400 dark:text-neutral-500">
        <span>{locale === "en" ? "Start" : "Inicio"}</span>
        {showExpected ? (
          <span className="text-right text-neutral-500 dark:text-neutral-400">{expected!.label}</span>
        ) : (
          <span>{locale === "en" ? "Complete" : "Completado"}</span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-3 flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 shadow-sm transition-colors hover:border-neutral-300 hover:text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:text-neutral-100"
      >
        <ChevronDown size={14} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
        {locale === "en" ? "Source detail" : "Detalle de la fuente"}
      </button>
      {open && (
        <div className="mt-2 rounded-lg bg-neutral-50 p-3 text-xs leading-5 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
          {detail}
        </div>
      )}
    </div>
  );
}
