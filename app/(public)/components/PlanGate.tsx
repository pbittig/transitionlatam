import Link from "next/link";
import { LockKeyhole } from "lucide-react";

export function PlanGate({
  locked,
  children,
  label = "Disponible en plan Lite o Premium",
  variant = "compact",
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
      <div className="group relative min-h-56 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 select-none overflow-hidden opacity-55 blur-[2px]"
        >
          {children}
        </div>
        <div className="absolute inset-0 bg-white/48 backdrop-blur-[4px]" />
        <div className="relative z-10 flex min-h-56 items-center justify-center">
          <Link
            href="/planes"
            title={label}
            aria-label={`${label}. Ver planes.`}
            className="relative flex h-14 w-14 items-center justify-center rounded-full border border-white/80 bg-white/75 text-brand-primary shadow-lg shadow-neutral-900/10 ring-1 ring-neutral-900/5 backdrop-blur-xl transition duration-200 hover:scale-105 hover:bg-white focus-visible:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-primary"
          >
            <LockKeyhole size={24} strokeWidth={2.2} />
            <span className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 w-max max-w-64 -translate-x-1/2 translate-y-1 rounded-lg bg-[#333333] px-3 py-2 text-center text-xs font-medium text-white opacity-0 shadow-lg transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
              {label}
            </span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <span className="group relative inline-grid min-h-9 max-w-full overflow-visible rounded-lg border border-neutral-200 bg-white align-middle shadow-sm">
      <span
        aria-hidden
        className="pointer-events-none col-start-1 row-start-1 select-none overflow-hidden rounded-lg opacity-55 blur-[2px]"
      >
        {children}
      </span>
      <span className="absolute inset-0 rounded-lg bg-white/48 backdrop-blur-[3px]" />
      <Link
        href="/planes"
        title={label}
        aria-label={`${label}. Ver planes.`}
        className="relative z-[2] col-start-1 row-start-1 m-auto flex h-7 w-7 items-center justify-center rounded-full border border-white/80 bg-white/80 text-brand-primary shadow-md shadow-neutral-900/10 ring-1 ring-neutral-900/5 backdrop-blur-xl transition duration-200 hover:scale-105 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
      >
        <LockKeyhole size={13} strokeWidth={2.4} />
        <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-20 w-max max-w-56 -translate-x-1/2 translate-y-1 rounded-lg bg-[#333333] px-2.5 py-1.5 text-center text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
          {label}
        </span>
      </Link>
    </span>
  );
}
