"use client";

import { useTransition } from "react";
import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import type { AppLocale } from "@/lib/i18n";
import { setLanguage } from "../languageActions";

export function LanguageSwitcher({ locale, compact = false }: { locale: AppLocale; compact?: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function changeLocale(next: AppLocale) {
    if (next === locale) return;
    startTransition(async () => {
      const result = await setLanguage(next);
      if (result.success) router.refresh();
    });
  }

  return (
    <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
      <Languages size={14} />
      <span className={compact ? "sr-only" : ""}>{locale === "en" ? "Language" : "Idioma"}</span>
      <select
        value={locale}
        disabled={pending}
        onChange={(event) => changeLocale(event.target.value as AppLocale)}
        aria-label={locale === "en" ? "Portal language" : "Idioma del portal"}
        className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
      >
        <option value="es">ES</option>
        <option value="en">EN</option>
      </select>
    </label>
  );
}
