"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unassignPertinenciaFromProject } from "../pertinenciaActions";

/**
 * Quita una pertinencia mal asociada — el gemelo de UnassignSeiaButton.
 *
 * Pide confirmación y el de SEIA no, a propósito: soltar el expediente SEIA
 * deja el dato donde estaba, mientras que soltar la pertinencia además la
 * devuelve a la cola de /admin/pertinencias y le borra la sugerencia. Es más
 * trabajo de deshacer, así que vale un clic extra.
 */
export function UnassignPertinenciaButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await unassignPertinenciaFromProject(projectId);
      if (result.success) {
        setConfirming(false);
        router.refresh();
      } else {
        setError(result.error ?? "No se pudo quitar la pertinencia.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {confirming && !pending && (
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="print:hidden text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-700 dark:text-neutral-400"
          >
            Cancelar
          </button>
        )}
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          className={`print:hidden text-xs font-medium underline underline-offset-2 disabled:opacity-50 ${
            confirming
              ? "text-red-600 hover:text-red-700 dark:text-red-400"
              : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          }`}
        >
          {pending ? "Quitando…" : confirming ? "Confirmar: vuelve a la cola" : "Quitar"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
