"use client";

import { useTransition } from "react";
import { Languages } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { AppLocale } from "@/lib/i18n";
import { equivalentLocalePath } from "@/lib/localizedRoutes";
import { setLanguage } from "../languageActions";

export function LanguageSwitcher({
  locale,
  compact = false,
  /** `dark` para superficies oscuras como el nav lateral, donde el pill blanco no pega. */
  tone = "light",
}: {
  locale: AppLocale;
  compact?: boolean;
  tone?: "light" | "dark";
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  function changeLocale(next: AppLocale) {
    if (next === locale) return;
    startTransition(async () => {
      const result = await setLanguage(next);
      if (result.success) router.replace(equivalentLocalePath(pathname, next));
    });
  }

  return (
    <label
      className={`inline-flex items-center gap-2 text-xs font-medium ${
        tone === "dark" ? "text-white/60" : "text-neutral-500 dark:text-neutral-400"
      }`}
    >
      <Languages size={14} />
      <span className={compact ? "sr-only" : ""}>{locale === "en" ? "Language" : "Idioma"}</span>
      <select
        value={locale}
        disabled={pending}
        onChange={(event) => changeLocale(event.target.value as AppLocale)}
        aria-label={locale === "en" ? "Portal language" : "Idioma del portal"}
        className={`rounded-lg px-2 py-1.5 text-xs ${
          tone === "dark"
            ? "border border-white/15 bg-white/[0.06] text-white"
            : "border border-neutral-200 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
        }`}
      >
        <option value="es" className="text-neutral-900">
          ES
        </option>
        <option value="en" className="text-neutral-900">
          EN
        </option>
      </select>
    </label>
  );
}
