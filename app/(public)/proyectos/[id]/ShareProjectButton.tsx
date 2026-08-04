"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import type { AppLocale } from "@/lib/i18n";

export function ShareProjectButton({ projectName, locale = "es" }: { projectName: string; locale?: AppLocale }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const shareData = {
      title: projectName,
      text: locale === "en"
        ? `View the ${projectName} project profile on Transition LATAM.`
        : `Revisa la ficha del proyecto ${projectName} en Transition LATAM.`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const label = copied
    ? locale === "en" ? "Link copied" : "Enlace copiado"
    : locale === "en" ? "Share project profile" : "Compartir ficha del proyecto";

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={label}
      title={label}
      className="grid size-9 shrink-0 place-items-center rounded-lg border border-neutral-200 text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:bg-neutral-900 dark:hover:text-white"
    >
      {copied ? <Check size={17} aria-hidden="true" /> : <Share2 size={17} aria-hidden="true" />}
    </button>
  );
}
