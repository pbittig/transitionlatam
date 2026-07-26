"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { getAiVerificationSuggestion, type AiSuggestionResult } from "./aiSuggestionActions";
import { assignSeiaMatch } from "../../proyectos/[id]/seiaActions";

/**
 * Sugerencia de IA (GLM-5.2) para el Verificador — bajo demanda, nunca
 * automática ni bloqueante. El admin pide la sugerencia, la lee, y decide si
 * usa el candidato SEIA propuesto (un clic) o la ignora. El botón "Verificado"
 * del Verificador sigue siendo la única acción que realmente cierra el caso.
 */
export function AiSuggestionPanel({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [result, setResult] = useState<AiSuggestionResult | null>(null);
  const [applied, setApplied] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [applying, startApplying] = useTransition();

  function handleAsk() {
    setApplied(false);
    setApplyError(null);
    startLoading(async () => {
      const r = await getAiVerificationSuggestion(projectId);
      setResult(r);
    });
  }

  function handleApply() {
    if (!result?.suggestion?.seiaPick || !result.candidates) return;
    const candidate = result.candidates.find((c) => c.EXPEDIENTE_ID === result.suggestion!.seiaPick);
    if (!candidate) return;
    setApplyError(null);
    startApplying(async () => {
      const r = await assignSeiaMatch(projectId, candidate, "");
      if (r.success) {
        setApplied(true);
        router.refresh();
      } else {
        setApplyError(r.error ?? "No se pudo asociar el candidato.");
      }
    });
  }

  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-900 dark:text-neutral-50">
          <Sparkles size={16} className="text-brand-primary" /> Sugerencia de IA (GLM-5.2)
        </div>
        <button
          type="button"
          onClick={handleAsk}
          disabled={loading}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {loading ? "Pensando…" : result ? "Pedir de nuevo" : "Pedir sugerencia de IA"}
        </button>
      </div>
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        Solo una segunda opinión — no verifica ni asocia nada por sí sola. Piloto validado sobre 40 proyectos reales
        antes de habilitarla acá.
      </p>

      {result && !result.success && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">⚠️ {result.error ?? "No se pudo obtener la sugerencia."}</p>
      )}

      {result?.success && result.suggestion && (
        <div className="mt-3 flex flex-col gap-3 border-t border-neutral-100 pt-3 dark:border-neutral-900">
          <div>
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Sanity check de los datos</p>
            <p className="text-sm text-neutral-900 dark:text-neutral-50">
              <span
                className={
                  result.suggestion.dataSanity === "ok"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                }
              >
                {result.suggestion.dataSanity === "ok" ? "OK" : "Sospechoso"}
              </span>{" "}
              — {result.suggestion.dataSanityReason}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Candidato SEIA sugerido</p>
            {result.suggestion.seiaPick ? (
              (() => {
                const candidate = result.candidates?.find((c) => c.EXPEDIENTE_ID === result.suggestion!.seiaPick);
                return (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-sm text-neutral-900 dark:text-neutral-50">
                      {candidate ? candidate.EXPEDIENTE_NOMBRE : `Expediente ${result.suggestion.seiaPick}`} —{" "}
                      {result.suggestion.seiaPickReason}
                    </p>
                    {applied ? (
                      <span className="flex w-fit items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={14} /> Candidato asociado
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleApply}
                        disabled={applying || !candidate}
                        className="w-fit rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
                      >
                        {applying ? "Asociando…" : "Usar este candidato"}
                      </button>
                    )}
                    {applyError && <p className="text-xs text-red-600 dark:text-red-400">{applyError}</p>}
                  </div>
                );
              })()
            ) : (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Ninguno — {result.suggestion.seiaPickReason}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
