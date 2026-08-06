"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  searchPertinenciasForAssociation,
  confirmPertinenciaMatch,
  type PertinenciaSearchCandidate,
} from "../../admin/pertinenciaActions";

export function PertinenciaMatchModal({
  projectId,
  projectName,
  hasExistingMatch,
  isAdmin = false,
}: {
  projectId: string;
  projectName: string;
  hasExistingMatch: boolean;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(projectName);
  const [candidates, setCandidates] = useState<PertinenciaSearchCandidate[]>([]);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [searching, startSearch] = useTransition();
  const [assigning, startAssign] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) return;
    debounceRef.current = setTimeout(() => {
      startSearch(async () => {
        const results = await searchPertinenciasForAssociation(query);
        setCandidates(results);
      });
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  function handlePick(candidate: PertinenciaSearchCandidate) {
    startAssign(async () => {
      try {
        await confirmPertinenciaMatch(candidate.id, projectId);
        setMessage({ type: "success", text: `Asociada "${candidate.name}". Actualizando...` });
        setTimeout(() => {
          setOpen(false);
          setMessage(null);
          setCandidates([]);
        }, 900);
      } catch (err) {
        setMessage({ type: "error", text: (err as Error).message || "No se pudo asociar." });
      }
    });
  }

  if (!isAdmin) return null;

  const visibleCandidates = query.trim().length >= 3 ? candidates : [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="print:hidden text-xs font-medium text-neutral-500 underline underline-offset-2 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
      >
        {hasExistingMatch ? "Corregir asociación de pertinencia" : "Asociación manual de pertinencia"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-neutral-200 p-4 dark:border-neutral-800">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                Asociar pertinencia SEA manualmente
              </h3>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Busca por nombre de la pertinencia o del titular y haz clic en la correcta.
              </p>

              <input
                type="text"
                autoFocus
                placeholder="Nombre o titular (mín. 3 letras)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="mt-2 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {searching && <p className="p-3 text-sm text-neutral-500 dark:text-neutral-400">Buscando...</p>}
              {!searching && query.trim().length >= 3 && candidates.length === 0 && (
                <p className="p-3 text-sm text-neutral-500 dark:text-neutral-400">Sin resultados.</p>
              )}
              {!searching &&
                visibleCandidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={assigning}
                    onClick={() => handlePick(c)}
                    className="block w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-800"
                  >
                    <div className="font-medium text-neutral-900 dark:text-neutral-50">{c.name}</div>
                    <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                      {c.titularName ?? "—"} · {c.correlativeId} · {c.estado ?? "—"}
                      {c.matchStatus === "confirmed" && c.matchedProjectName && (
                        <span className="text-amber-600 dark:text-amber-400"> · ya asociada a &quot;{c.matchedProjectName}&quot;</span>
                      )}
                    </div>
                  </button>
                ))}
            </div>

            {message && (
              <div
                className={`border-t p-3 text-sm ${
                  message.type === "error"
                    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400"
                }`}
              >
                {message.text}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
