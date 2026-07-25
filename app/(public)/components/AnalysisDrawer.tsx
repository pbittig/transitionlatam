"use client";

import { useState } from "react";
import { ChevronLeft, X } from "lucide-react";

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
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Mostrar análisis"
        className={`fixed top-1/2 right-0 z-30 flex h-36 w-11 -translate-y-1/2 flex-col items-center justify-center gap-2 rounded-l-xl border border-r-0 border-neutral-300 bg-neutral-200 text-xs font-semibold tracking-wide text-neutral-700 shadow-md transition-all hover:w-12 hover:bg-neutral-300 print:hidden dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 ${
          open ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <ChevronLeft size={17} aria-hidden />
        <span style={{ writingMode: "vertical-rl" }}>ANÁLISIS</span>
      </button>

      <div
        className={`fixed inset-y-0 right-0 left-16 z-40 flex flex-col border-l border-neutral-200 bg-white shadow-2xl transition-transform duration-300 ease-in-out md:left-64 dark:border-neutral-800 dark:bg-neutral-900 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <div className="flex items-start justify-between border-b border-neutral-100 px-6 py-4 dark:border-neutral-900">
          <div>
            <h2 className="text-sm font-semibold tracking-widest text-neutral-600 uppercase dark:text-neutral-300">{title}</h2>
            {description && <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{description}</p>}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
            className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
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
