"use client";

import Link from "next/link";
import { ArrowUpRight, Eye, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { AppLocale } from "@/lib/i18n";

export function FreeFeaturePreview({
  title,
  description,
  children,
  locale,
  wide = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  locale: AppLocale;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 border-y border-brand-primary/30 bg-brand-surface/55 px-5 py-4 dark:bg-brand-primary/5" aria-label={locale === "en" ? "Prime preview" : "Vista previa de Prime"}>
      <div>
        <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-deep dark:text-brand-primary"><Eye size={15} />{locale === "en" ? "Prime preview" : "Vista previa de Prime"}</p>
        <p className="mt-1 text-sm font-medium text-neutral-700 dark:text-neutral-200">{title}</p>
      </div>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-brand-ink shadow-sm hover:bg-brand-primary/85">
        <Eye size={16} /> {locale === "en" ? "View example" : "Ver ejemplo"}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-neutral-950/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="free-preview-title" className={`max-h-[90dvh] w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white p-5 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950 sm:p-6 ${wide ? "max-w-5xl" : "max-w-3xl"}`} onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-deep dark:text-brand-primary"><Eye size={15} />{locale === "en" ? "Prime preview" : "Vista previa de Prime"}</p>
                <h2 id="free-preview-title" className="mt-2 text-xl font-semibold text-neutral-950 dark:text-white">{title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">{description}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label={locale === "en" ? "Close example" : "Cerrar ejemplo"} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-900 dark:text-neutral-300">
                <X size={18} />
              </button>
            </div>
            <div className="mt-5">{children}</div>
            <div className="mt-6 flex justify-end border-t border-neutral-100 pt-4 dark:border-neutral-800">
              <Link href="/planes" className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-brand-ink shadow-sm hover:bg-brand-primary/85">
                {locale === "en" ? "View plans" : "Ver planes"} <ArrowUpRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
