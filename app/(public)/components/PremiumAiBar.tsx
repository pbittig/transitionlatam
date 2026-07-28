"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, FileText, LockKeyhole, Send, Sparkles, X } from "lucide-react";

export function PremiumAiBar({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <aside className="fixed right-4 bottom-4 z-30 print:hidden md:right-6 md:bottom-6">
      {open && (
        <div className="mb-3 w-[min(400px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-brand-primary/35 bg-white/97 shadow-2xl shadow-brand-deep/20 backdrop-blur-xl dark:bg-neutral-950/97">
          <div className="flex items-center justify-between border-b border-brand-primary/20 bg-gradient-to-r from-brand-ink to-brand-deep px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-12 items-center justify-center rounded-lg bg-white px-1.5 shadow-sm">
                <Image src="/tl-logo.png" alt="" width={92} height={32} className="h-auto w-full" />
              </span>
              <div>
                <p className="text-sm font-semibold">Transition AI</p>
                <p className="text-[10px] text-white/65">Consulta la información de la plataforma</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar Transition AI"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          {enabled ? (
            <div className="p-4">
              <div className="rounded-xl border border-brand-primary/20 bg-brand-surface p-3 dark:bg-brand-primary/10">
                <div className="flex items-center gap-2 text-xs font-semibold text-brand-deep dark:text-brand-primary">
                  <Sparkles size={13} /> Vista previa de Premium
                </div>
                <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                  Pronto podrás consultar proyectos, comparar empresas y generar reportes desde aquí.
                </p>
              </div>
              <div className="mt-3 flex gap-2 overflow-hidden">
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-surface px-2.5 py-1.5 text-[10px] font-medium text-brand-deep dark:bg-brand-primary/10 dark:text-brand-primary">
                  <Sparkles size={11} /> Analizar proyectos
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1.5 text-[10px] font-medium text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                  <FileText size={11} /> Crear reporte
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1.5 text-[10px] font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                  <BarChart3 size={11} /> Comparar
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-900">
                <span className="flex-1 text-sm text-neutral-400">Pregunta sobre proyectos o mercado…</span>
                <button
                  type="button"
                  disabled
                  aria-label="Transition AI estará disponible próximamente"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary text-neutral-950 opacity-60"
                >
                  <Send size={14} />
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] text-neutral-400">Funcionalidad próximamente disponible</p>
            </div>
          ) : (
            <div className="p-5 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-surface text-brand-deep dark:bg-brand-primary/10 dark:text-brand-primary">
                <LockKeyhole size={19} />
              </span>
              <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">Transition AI estará disponible en Premium</p>
              <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Haz preguntas sobre la información, compara proyectos y prepara reportes desde la plataforma.
              </p>
              <Link
                href="/planes"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-deep px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-ink dark:bg-brand-primary dark:text-neutral-950"
              >
                Conocer Premium <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Cerrar Transition AI" : "Abrir Transition AI"}
        className="ml-auto flex items-center gap-2 rounded-2xl border border-brand-primary/45 bg-white px-2.5 py-2 shadow-xl shadow-brand-deep/20 transition hover:-translate-y-0.5 hover:border-brand-primary hover:shadow-2xl dark:bg-neutral-950"
      >
        <span className="flex h-9 w-12 items-center justify-center rounded-xl bg-white px-1">
          <Image src="/tl-logo.png" alt="" width={92} height={32} className="h-auto w-full" />
        </span>
        <span className="pr-1 text-left">
          <span className="block text-xs font-semibold text-brand-ink dark:text-white">Chat con Transition AI</span>
          <span className="block text-[9px] font-medium text-brand-deep dark:text-brand-primary">
            {enabled ? "Premium · próximamente" : "Disponible con Premium"}
          </span>
        </span>
        {!enabled && <LockKeyhole size={13} className="mr-1 text-neutral-400" />}
      </button>
    </aside>
  );
}
