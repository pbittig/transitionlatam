"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unassignSeiaMatch } from "../projectEditActions";

/** Botón de un clic para desvincular un match SEIA equivocado — visible solo cuando ya hay un expediente asociado. */
export function UnassignSeiaButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await unassignSeiaMatch(projectId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error ?? "No se pudo desvincular.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="print:hidden text-xs font-medium text-neutral-500 underline underline-offset-2 hover:text-neutral-700 disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-200"
      >
        {pending ? "Quitando…" : "Quitar"}
      </button>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
