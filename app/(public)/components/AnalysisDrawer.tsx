"use client";

import { useState } from "react";
import { BarChart3, ChevronLeft, X } from "lucide-react";

/**
 * Franja fija en el borde derecho de la pantalla — al hacer click se
 * despliega un panel que cubre todo el ancho disponible (hasta el borde del
 * sidebar, nunca encima de él) con los gráficos/análisis adentro, dejando la
 * tabla de la página como el contenido central siempre visible.
 */
export function AnalysisDrawer({
  children,
  title = "Análisis",
  description,
  triggerVariant = "fixed",
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
  triggerVariant?: "fixed" | "inline";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Mostrar análisis"
        className={`${triggerVariant === "fixed"
          ? "fixed top-1/2 right-0 z-30 -translate-y-1/2 rounded-l-xl border-r-0 px-3 py-3 text-xs hover:pr-4"
          : "relative z-0 rounded-xl px-4 py-2.5 text-sm"
        } flex items-center gap-2 border border-brand-primary/40 bg-brand-deep font-semibold text-white shadow-lg shadow-brand-deep/20 transition-all hover:bg-brand-ink print:hidden dark:bg-brand-primary dark:text-neutral-950 ${
          open ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <ChevronLeft size={17} aria-hidden />
        <BarChart3 size={16} aria-hidden />
        <span className="hidden sm:inline">Ver análisis</span>
      </button>

      <div
        className={`fixed inset-y-0 right-0 left-16 z-40 flex flex-col border-l border-neutral-200 bg-white shadow-2xl transition-transform duration-300 ease-in-out md:left-64 dark:border-neutral-800 dark:bg-neutral-900 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <div className="flex items-start justify-between border-b border-brand-primary/20 bg-gradient-to-r from-brand-ink to-brand-deep px-6 py-4 text-white">
          <div>
            <h2 className="text-sm font-semibold tracking-widest uppercase">{title}</h2>
            {description && <p className="mt-1 text-sm text-white/65">{description}</p>}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
            className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-8">{children}</div>
        </div>
      </div>
    </>
  );
}
