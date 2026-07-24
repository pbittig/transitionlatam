"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BriefcaseBusiness, CircleCheck } from "lucide-react";
import { addProjectToOpportunity } from "../crmActions";

export function AddToCrmButton({
  projectId,
  projectName,
  developerCompanyId,
  initiallyInCrm,
  compact = false,
}: {
  projectId: string;
  projectName: string;
  developerCompanyId: string | null;
  initiallyInCrm: boolean;
  compact?: boolean;
}) {
  const [inCrm, setInCrm] = useState(initiallyInCrm);
  const [pending, startTransition] = useTransition();

  if (inCrm) {
    return (
      <Link
        href="/crm"
        title="Ya está en el CRM — ver en el tablero"
        aria-label="Ver en el CRM"
        className={
          compact
            ? "inline-flex h-7 w-7 items-center justify-center rounded-md text-brand-primary hover:bg-neutral-100 dark:hover:bg-neutral-800"
            : "print:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-900 bg-neutral-900 text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-900"
        }
      >
        <CircleCheck size={compact ? 15 : 16} strokeWidth={2} />
      </Link>
    );
  }

  function handleAdd() {
    startTransition(async () => {
      const result = await addProjectToOpportunity(projectId, projectName, developerCompanyId);
      if (result.success) setInCrm(true);
    });
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      disabled={pending}
      title="Agregar al CRM"
      aria-label="Agregar al CRM"
      className={
        compact
          ? "inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800"
          : "print:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      }
    >
      <BriefcaseBusiness size={compact ? 15 : 16} strokeWidth={2} />
    </button>
  );
}
