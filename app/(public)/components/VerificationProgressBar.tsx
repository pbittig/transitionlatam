import type { VerificationProgress } from "@/lib/data-access/projects";
import { ShieldCheck } from "lucide-react";
import type { AppLocale } from "@/lib/i18n";

/** Señal pública de calidad editorial para las fichas revisadas manualmente. */
export function VerificationProgressBar({ progress, locale = "es" }: { progress: VerificationProgress; locale?: AppLocale }) {
  const upcoming = Math.max(0, progress.total - progress.verified);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-primary ring-1 ring-neutral-200">
        <ShieldCheck size={17} />
      </span>
      <div>
        <p className="text-sm font-semibold text-neutral-900">
          {progress.verified.toLocaleString(locale === "en" ? "en-US" : "es-CL")} {locale === "en" ? "validated project profiles" : "proyectos con ficha validada"}
        </p>
        <p className="mt-0.5 text-xs text-neutral-500">
          {locale === "en" ? "Information reviewed and structured by our team." : "Información revisada y estructurada por nuestro equipo."}
        </p>
        {upcoming > 0 && (
          <p className="mt-1 text-xs font-medium text-neutral-700">
            {locale === "en" ? "Next expansion:" : "Próxima ampliación:"} {upcoming.toLocaleString(locale === "en" ? "en-US" : "es-CL")} {locale === "en" ? "additional project profiles in the editorial pipeline." : "proyectos adicionales por incorporar."}
          </p>
        )}
      </div>
    </div>
  );
}
