"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ContactRound, CircleCheck, XCircle } from "lucide-react";
import { addProjectToOpportunity, deactivateProjectFromCrm } from "../crmActions";

export function AddToCrmButton({
  projectId,
  projectName,
  developerCompanyId,
  initiallyInCrm,
  compact = false,
  locked = false,
}: {
  projectId: string;
  projectName: string;
  developerCompanyId: string | null;
  initiallyInCrm: boolean;
  compact?: boolean;
  locked?: boolean;
}) {
  const [inCrm, setInCrm] = useState(initiallyInCrm);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (locked) {
    return (
      <span
        title="Disponible en plan Prime"
        aria-label="Agregar al CRM — disponible en plan Prime"
        className={
          compact
            ? "inline-flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-md text-neutral-300 dark:text-neutral-700"
            : "print:hidden flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-lg border border-neutral-200 text-neutral-300 dark:border-neutral-800 dark:text-neutral-700"
        }
      >
        <ContactRound size={compact ? 15 : 16} strokeWidth={2} />
      </span>
    );
  }

  if (inCrm) {
    if (!compact) {
      function handleDeactivate() {
        setError(null);
        startTransition(async () => {
          const result = await deactivateProjectFromCrm(projectId);
          if (result.success) {
            setInCrm(false);
            setConfirmingDeactivate(false);
          } else {
            setError(result.error ?? "No se pudo desactivar del CRM.");
          }
        });
      }

      return (
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/crm"
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-deep bg-brand-primary px-3 py-2 text-xs font-semibold text-[#173c38] shadow-sm"
            >
              <CircleCheck size={15} /> Ver en CRM
            </Link>
            {confirmingDeactivate ? (
              <>
                <button
                  type="button"
                  onClick={handleDeactivate}
                  disabled={pending}
                  className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {pending ? "Desactivando…" : "Confirmar"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDeactivate(false)}
                  disabled={pending}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-medium dark:border-neutral-700"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDeactivate(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              >
                <XCircle size={15} /> Desactivar del CRM
              </button>
            )}
          </div>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      );
    }
    return (
      <Link
        href="/crm"
        title="Ya está en el CRM — ver en el tablero"
        aria-label="Ver en el CRM"
        className={
          compact
            ? "inline-flex h-7 w-7 items-center justify-center rounded-md text-brand-primary hover:bg-neutral-100 dark:hover:bg-neutral-800"
            : "print:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-brand-deep bg-brand-primary text-[#173c38] shadow-sm ring-1 ring-brand-deep/20"
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
          : "print:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-brand-primary bg-brand-primary text-[#173c38] shadow-sm hover:brightness-95 disabled:opacity-50"
      }
    >
      <ContactRound size={compact ? 15 : 16} strokeWidth={2} />
    </button>
  );
}
