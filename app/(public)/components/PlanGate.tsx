import Link from "next/link";
import { ArrowRight, Check, LockKeyhole, Sparkles } from "lucide-react";

export function PlanGate({
  locked,
  children,
  label = "Disponible en plan Lite o Premium",
  variant = "compact",
  title = "Desbloquea esta vista",
  description = "Convierte los datos de mercado en una herramienta de prospección y seguimiento comercial.",
  features = [],
}: {
  locked: boolean;
  children: React.ReactNode;
  label?: string;
  variant?: "compact" | "showcase";
  title?: string;
  description?: string;
  features?: string[];
}) {
  if (!locked) return <>{children}</>;

  if (variant === "showcase") {
    return (
      <div className="relative min-h-56 overflow-hidden rounded-2xl border border-brand-primary/25 bg-brand-surface shadow-sm dark:border-brand-primary/15 dark:bg-neutral-950">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 select-none overflow-hidden opacity-35 blur-[3px]"
        >
          {children}
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/10 via-white/90 to-white dark:from-brand-primary/10 dark:via-neutral-950/90 dark:to-neutral-950" />
        <div className="relative z-10 flex min-h-56 items-center justify-center px-5 py-8">
          <div className="w-full max-w-xl rounded-2xl border border-brand-primary/30 bg-white/95 p-5 text-center shadow-xl shadow-brand-deep/10 backdrop-blur-xl dark:border-brand-primary/20 dark:bg-neutral-900/95 dark:shadow-black/30">
            <span className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-brand-primary/15 px-3 py-1 text-[11px] font-semibold tracking-wide text-brand-deep uppercase dark:text-brand-primary">
              <Sparkles size={12} /> Vista de ejemplo
            </span>
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">{title}</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-neutral-600 dark:text-neutral-300">{description}</p>
            {features.length > 0 && (
              <ul className="mx-auto mt-4 grid max-w-lg gap-2 text-left sm:grid-cols-2">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-primary/15 text-neutral-800 dark:text-neutral-100">
                      <Check size={10} strokeWidth={2.5} />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/planes"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-deep px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-ink dark:bg-brand-primary dark:text-neutral-950 dark:hover:bg-brand-primary/85"
              >
                Ver opciones de acceso <ArrowRight size={15} />
              </Link>
              <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                <LockKeyhole size={12} /> {label}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <span className="relative inline-grid max-w-full overflow-hidden rounded-md align-middle">
      <span aria-hidden className="pointer-events-none col-start-1 row-start-1 select-none opacity-35 blur-[4px]">
        {children}
      </span>
      <span
        title={label}
        className="col-start-1 row-start-1 flex min-h-6 items-center justify-center gap-1 rounded-md border border-neutral-200/80 bg-white/90 px-2 text-center text-[10px] leading-tight font-semibold text-neutral-600 shadow-sm backdrop-blur-md dark:border-neutral-700/80 dark:bg-neutral-900/90 dark:text-neutral-200"
      >
        <LockKeyhole size={10} className="shrink-0" />
        <span className="truncate">Plan Lite+</span>
      </span>
    </span>
  );
}
