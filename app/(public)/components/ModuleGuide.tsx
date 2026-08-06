import Link from "next/link";
import { ArrowRight, ChevronDown, Compass, LockKeyhole, PackageCheck, Route } from "lucide-react";
import type { AppLocale } from "@/lib/i18n";

export function ModuleGuide({
  purpose,
  deliverables,
  howToUse,
  plan,
  upgradeMessage,
  locale = "es",
}: {
  purpose: string;
  deliverables: string[];
  howToUse: string[];
  plan: "Free" | "Prime";
  upgradeMessage: string;
  locale?: AppLocale;
}) {
  const blocks = [
    { icon: Compass, title: locale === "en" ? "Purpose" : "Para qué sirve", content: <p>{purpose}</p> },
    {
      icon: PackageCheck,
      title: locale === "en" ? "What you get" : "Qué recibes",
      content: (
        <ul className="space-y-1.5">
          {deliverables.map((item) => <li key={item}>• {item}</li>)}
        </ul>
      ),
    },
    {
      icon: Route,
      title: locale === "en" ? "How to use it" : "Cómo aprovecharlo",
      content: (
        <ol className="space-y-1.5">
          {howToUse.map((item, index) => <li key={item}>{index + 1}. {item}</li>)}
        </ol>
      ),
    },
  ];

  return (
    <details className="group overflow-hidden rounded-2xl border border-neutral-950 bg-white shadow-sm" aria-label={locale === "en" ? "Section guide" : "Guía de esta sección"}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 bg-neutral-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-black">
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary/15 text-brand-primary">
            <Compass size={16} />
          </span>
          {locale === "en" ? "How to get the most out of this section" : "Cómo sacarle provecho a esta sección"}
        </span>
        <ChevronDown size={17} className="text-brand-primary transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-brand-primary/40">
        <div className="grid gap-px bg-neutral-100 md:grid-cols-3">
          {blocks.map(({ icon: Icon, title, content }) => (
            <article key={title} className="bg-white p-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-800">
                <Icon size={15} className="text-brand-primary" />
                {title}
              </div>
              <div className="mt-3 text-sm leading-6 text-neutral-600">{content}</div>
            </article>
          ))}
        </div>
        <div className="flex flex-col gap-3 border-t border-neutral-100 bg-neutral-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <LockKeyhole size={14} className="mt-0.5 shrink-0 text-brand-primary" />
            <div>
              <p className="text-xs font-semibold text-neutral-900">{locale === "en" ? `Available from the ${plan} plan` : `Disponible desde el plan ${plan}`}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{upgradeMessage}</p>
            </div>
          </div>
          <Link href="/planes" className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-neutral-800 hover:text-black">
            {locale === "en" ? "Compare plans" : "Comparar planes"} <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </details>
  );
}
