"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import type { AppLocale } from "@/lib/i18n";

/** Buscador de texto — preserva el resto de filtros activos (chips, estado, tab) vía inputs ocultos. */
export function SearchBar({
  basePath,
  value,
  otherParams,
  placeholder = "Buscar por nombre...",
  children,
  locale = "es",
}: {
  basePath: string;
  value: string | undefined;
  otherParams: Record<string, string | undefined>;
  placeholder?: string;
  /** Controles extra (ej. un <select> de estado) que se envían junto con la búsqueda, en el mismo form. */
  children?: React.ReactNode;
  locale?: AppLocale;
}) {
  const router = useRouter();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const [key, rawValue] of formData.entries()) {
      const value = String(rawValue).trim();
      if (value) params.set(key, value);
    }
    params.delete("page");
    const query = params.toString();
    router.replace(query ? `${basePath}?${query}` : basePath, { scroll: false });
  }

  return (
    <form className="grid grid-cols-[1fr_auto] items-center gap-2 sm:flex sm:flex-wrap" action={basePath} onSubmit={handleSubmit}>
      {Object.entries(otherParams).map(
        ([key, val]) => val && <input key={key} type="hidden" name={key} value={val} />,
      )}
      <input
        type="text"
        name="q"
        defaultValue={value ?? ""}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-transparent px-3 py-2.5 text-base sm:min-w-[240px] sm:py-2 sm:text-sm dark:border-neutral-700"
      />
      {children}
      <button
        type="submit"
        className="min-h-11 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 sm:min-h-0 sm:rounded-lg dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {locale === "en" ? "Search" : "Buscar"}
      </button>
      {value && (
        <Link
          href={(() => {
            const qs = new URLSearchParams();
            for (const [k, v] of Object.entries(otherParams)) if (v) qs.set(k, v);
            const query = qs.toString();
            return query ? `${basePath}?${query}` : basePath;
          })()}
          scroll={false}
          className="col-span-2 text-sm text-neutral-500 hover:underline sm:col-span-1 dark:text-neutral-400"
        >
          {locale === "en" ? "Clear search" : "Limpiar búsqueda"}
        </Link>
      )}
    </form>
  );
}
