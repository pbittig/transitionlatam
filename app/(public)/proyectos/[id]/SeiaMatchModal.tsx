"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { searchSeiaForAssociation, assignSeiaMatch, type SeiaCandidate } from "./seiaActions";

// El buscador de SEIA hace un match casi literal del texto contra el nombre del
// expediente — probar "BESS Chungará (Ex - BESS Parinacota)" completo da 0
// resultados en el sitio real, mientras que "BESS Chungará" solo sí lo encuentra
// (hallazgo real). Los alias entre paréntesis ("Ex - ...", "ex ...") son ruido
// para esa búsqueda, así que se precargan fuera para no obligar al admin a
// adivinar un término más corto.
function stripAliasSuffix(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*/g, " ").trim();
}

export function SeiaMatchModal({
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
  const [query, setQuery] = useState(() => stripAliasSuffix(projectName));
  const [candidates, setCandidates] = useState<SeiaCandidate[]>([]);
  const [adminSecret, setAdminSecret] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [searching, startSearch] = useTransition();
  const [assigning, startAssign] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setCandidates([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startSearch(async () => {
        const results = await searchSeiaForAssociation(query);
        setCandidates(results);
      });
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open]);

  function handlePick(candidate: SeiaCandidate) {
    if (!isAdmin && !adminSecret) {
      setMessage({ type: "error", text: "Ingresa la clave de administrador antes de asociar." });
      return;
    }
    startAssign(async () => {
      const result = await assignSeiaMatch(projectId, candidate.raw, adminSecret);
      if (result.success) {
        setMessage({ type: "success", text: `Asociado a "${candidate.nombre}". Actualizando...` });
        setTimeout(() => {
          setOpen(false);
          setMessage(null);
          setQuery("");
          setCandidates([]);
        }, 900);
      } else {
        setMessage({ type: "error", text: result.error ?? "No se pudo asociar." });
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="print:hidden text-xs font-medium text-neutral-500 underline underline-offset-2 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
      >
        {hasExistingMatch ? "Corregir asociación SEIA" : "Asociar manualmente con SEIA"}
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
                Asociar expediente SEIA manualmente
              </h3>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Busca por nombre de proyecto y haz clic en el expediente correcto.
              </p>

              {!isAdmin && (
                <input
                  type="password"
                  placeholder="Clave de administrador"
                  value={adminSecret}
                  onChange={(e) => setAdminSecret(e.target.value)}
                  className="mt-3 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
                />
              )}

              <input
                type="text"
                autoFocus
                placeholder="Nombre del proyecto (mín. 3 letras)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="mt-2 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {searching && <p className="p-3 text-sm text-neutral-500 dark:text-neutral-400">Buscando...</p>}
              {!searching && query.trim().length >= 3 && candidates.length === 0 && (
                <p className="p-3 text-sm text-neutral-500 dark:text-neutral-400">Sin resultados en SEIA.</p>
              )}
              {!searching &&
                candidates.map((c) => (
                  <button
                    key={c.expedienteId}
                    type="button"
                    disabled={assigning}
                    onClick={() => handlePick(c)}
                    className="block w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-800"
                  >
                    <div className="font-medium text-neutral-900 dark:text-neutral-50">{c.nombre}</div>
                    <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                      {c.titular} · {c.comuna}, {c.region} · {c.estado}
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
