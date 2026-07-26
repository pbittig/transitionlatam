"use client";

import { useState, useTransition } from "react";
import { FileText } from "lucide-react";
import { getFormularioDocumentLink } from "./formularioDocumentActions";

/** Abre el Formulario original (PDF/Excel) en una pestaña nueva — para cotejar lo que Nemotron extrajo contra la fuente. */
export function FormularioDocumentLink({ projectId }: { projectId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await getFormularioDocumentLink(projectId);
      if (result.success && result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      } else {
        setError(result.error ?? "No se pudo obtener el documento.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        <FileText size={14} /> {pending ? "Abriendo…" : "Ver Formulario original"}
      </button>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
