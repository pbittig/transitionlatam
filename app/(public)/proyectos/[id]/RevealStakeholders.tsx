"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { revealStakeholders } from "./seiaActions";
import type { ProjectStakeholder } from "@/lib/data-access/projects";
import type { AppLocale } from "@/lib/i18n";

interface MaskedContact {
  name: string;
  email: string | null;
}

export function RevealStakeholders({
  projectId,
  developerCompanyId,
  canReveal = false,
  maskedPreview = [],
  locale = "es",
}: {
  projectId: string;
  developerCompanyId: string | null;
  canReveal?: boolean;
  maskedPreview?: MaskedContact[];
  locale?: AppLocale;
}) {
  const [stakeholders, setStakeholders] = useState<ProjectStakeholder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleReveal(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await revealStakeholders(projectId, developerCompanyId);
      if (result.success) {
        setStakeholders(result.stakeholders ?? []);
      } else {
        setError(result.error ?? "No se pudo revelar.");
      }
    });
  }

  if (stakeholders !== null) {
    if (stakeholders.length === 0) {
      return <p className="text-sm text-neutral-500 dark:text-neutral-400">{locale === "en" ? "No contacts are registered yet." : "Sin contactos registrados todavía."}</p>;
    }
    return (
      <ul className="grid gap-3 sm:grid-cols-2">
        {stakeholders.map((s) => (
          <li key={s.personId} className="rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
            <div className="font-medium text-neutral-900 dark:text-neutral-50">{s.name}</div>
            {s.email && <div className="mt-1 text-neutral-600 dark:text-neutral-400">{s.email}</div>}
            {s.phone && <div className="text-neutral-600 dark:text-neutral-400">{s.phone}</div>}
          </li>
        ))}
      </ul>
    );
  }

  if (canReveal) {
    if (error) {
      return (
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => handleReveal()}
            disabled={pending}
            className="mt-2 text-xs font-medium text-neutral-500 underline underline-offset-2 hover:text-neutral-700 disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            {locale === "en" ? "Try again" : "Reintentar"}
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => handleReveal()}
        disabled={pending}
        className="rounded-lg bg-[#333333] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? (locale === "en" ? "Loading..." : "Cargando...") : (locale === "en" ? "View contact" : "Ver contacto")}
      </button>
    );
  }

  return (
    <div className="print:hidden flex flex-col gap-3">
      {maskedPreview.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {maskedPreview.map((c, i) => (
            <li key={i} className="rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
              <div className="font-medium text-neutral-900 dark:text-neutral-50">{c.name}</div>
              {c.email && <div className="mt-1 text-neutral-600 dark:text-neutral-400">{c.email}</div>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {locale === "en" ? "No contacts are registered yet." : "Sin contactos registrados todavía."}
        </p>
      )}
      <Link
        href="/planes"
        className="w-fit text-xs font-medium text-brand-deep underline underline-offset-2 hover:text-brand-primary dark:text-neutral-300"
      >
        {locale === "en" ? "Contact details available on Prime — see plans" : "El contacto completo está disponible en Prime — ver planes"}
      </Link>
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
