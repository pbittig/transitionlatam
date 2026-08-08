"use client";

import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { getStatusMaturity, isRejectedStatus } from "@/lib/shared/projectStatusMaturity";
import type { AppLocale } from "@/lib/i18n";
import { ExpandableProgressBar } from "./ExpandableProgressBar";
import { findSuctdSibling, type SuctdSiblingResult } from "./findSuctdSiblingAction";

const ACCESO_ABIERTO_URL = "https://accesoabierto.coordinador.cl";

export function FindSuctdSiblingButton({ projectId, locale = "es" }: { projectId: string; locale?: AppLocale }) {
  const en = locale === "en";
  const [pending, startTransition] = useTransition();
  const [searched, setSearched] = useState(false);
  const [result, setResult] = useState<SuctdSiblingResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleSearch() {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const sibling = await findSuctdSibling(projectId);
        setResult(sibling);
        setSearched(true);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : String(err));
      }
    });
  }

  if (!searched) {
    return (
      <button
        type="button"
        onClick={handleSearch}
        disabled={pending}
        className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 shadow-sm transition-colors hover:border-neutral-300 hover:text-neutral-800 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:text-neutral-100"
      >
        <Search size={14} />
        {pending
          ? en ? "Searching in Acceso Abierto…" : "Buscando en Acceso Abierto…"
          : en ? "Search for SUCTD request" : "Buscar solicitud SUCTD"}
      </button>
    );
  }

  if (errorMessage) {
    return <p className="text-xs text-red-600 dark:text-red-400">{errorMessage}</p>;
  }

  if (!result) {
    return (
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {en ? "No SUCTD request found yet for this project in Acceso Abierto." : "Aún no se encontró una solicitud SUCTD asociada a este proyecto en Acceso Abierto."}
      </p>
    );
  }

  const maturity = getStatusMaturity(result.statusLabel);
  const terminal = isRejectedStatus(result.statusLabel);

  return (
    <div>
      <ExpandableProgressBar
        title={en ? "SUCTD request found" : "Solicitud SUCTD encontrada"}
        status={result.statusLabel}
        percentage={maturity?.order ?? null}
        badgeLabel={terminal ? (en ? "Process ended" : "Proceso terminado") : maturity ? `${maturity.order}%` : en ? "Progress unavailable" : "Sin avance calculable"}
        terminal={terminal}
        locale={locale}
        detail={
          <>
            <p>
              {en ? "Found in the live Acceso Abierto feed by matching project name — the scheduled sync hasn't promoted it onto this record yet." : "Encontrada en el feed en vivo de Acceso Abierto por coincidencia de nombre — el sync programado aún no la ha promovido sobre este registro."}
            </p>
            <p className="mt-1 text-neutral-500">
              {en ? "Request ID" : "ID de solicitud"}: {result.externalId}
              {result.requestType && ` · ${result.requestType}`}
            </p>
            <a href={ACCESO_ABIERTO_URL} target="_blank" rel="noreferrer" className="mt-2 inline-block font-medium text-brand-deep underline">
              {en ? "Open Acceso Abierto portal" : "Ver portal Acceso Abierto"}
            </a>
          </>
        }
      />
    </div>
  );
}
