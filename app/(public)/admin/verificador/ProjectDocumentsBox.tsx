"use client";

import { useState, useTransition } from "react";
import { FolderOpen, FileText, Loader2 } from "lucide-react";
import {
  listProjectDocuments,
  getProjectDocumentUrl,
  type ProjectDocumentItem,
} from "./projectDocumentsActions";

/**
 * Trae a la ficha todos los archivos que Acceso Abierto muestra para la
 * solicitud de este proyecto, para no tener que abrir el portal y buscarlos.
 *
 * Los documentos se agrupan por tipo porque es como los piensa el trámite —
 * "Informe CTD definitivo", "Formulario SUCTD"— y porque el portal suele
 * publicar el mismo documento dos veces (PDF y Excel, o dos versiones), que
 * juntas se leen de un vistazo y sueltas parecen archivos distintos.
 *
 * Cada archivo se abre firmando su URL en el momento: las de S3 duran ~30
 * segundos, así que firmarlas todas al listar daría una caja de enlaces
 * vencidos.
 */
export function ProjectDocumentsBox({ projectId }: { projectId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [documentos, setDocumentos] = useState<ProjectDocumentItem[] | null>(null);
  const [solicitudId, setSolicitudId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abriendo, setAbriendo] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    if (abierto) {
      setAbierto(false);
      return;
    }
    setAbierto(true);
    if (documentos) return; // ya se trajeron: no se vuelve a pedir al plegar y desplegar
    setError(null);
    startTransition(async () => {
      const result = await listProjectDocuments(projectId);
      if (result.success) {
        setDocumentos(result.documentos ?? []);
        setSolicitudId(result.solicitudId ?? null);
      } else {
        setError(result.error ?? "No se pudieron obtener los documentos.");
      }
    });
  }

  function handleOpen(documentId: number) {
    setError(null);
    setAbriendo(documentId);
    // La pestaña se abre ANTES del await: si se abriera después, el navegador
    // lo trata como popup no solicitado y lo bloquea.
    const tab = window.open("", "_blank", "noopener,noreferrer");
    getProjectDocumentUrl(projectId, documentId)
      .then((result) => {
        if (result.success && result.url) {
          if (tab) tab.location.href = result.url;
        } else {
          tab?.close();
          setError(result.error ?? "No se pudo abrir el documento.");
        }
      })
      .finally(() => setAbriendo(null));
  }

  const porTipo = new Map<string, ProjectDocumentItem[]>();
  for (const d of documentos ?? []) {
    if (!porTipo.has(d.tipoDocumento)) porTipo.set(d.tipoDocumento, []);
    porTipo.get(d.tipoDocumento)!.push(d);
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        <FolderOpen size={14} />
        {abierto ? "Ocultar documentos" : "Ver documentos de Acceso Abierto"}
      </button>

      {abierto && (
        <div className="w-full rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 text-left dark:border-neutral-800 dark:bg-neutral-900/40">
          {pending && (
            <p className="flex items-center gap-2 text-xs text-neutral-500">
              <Loader2 size={14} className="animate-spin" /> Consultando Acceso Abierto…
            </p>
          )}

          {!pending && documentos && documentos.length === 0 && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Acceso Abierto no tiene documentos publicados para esta solicitud.
            </p>
          )}

          {!pending && documentos && documentos.length > 0 && (
            <>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {documentos.length} {documentos.length === 1 ? "documento" : "documentos"} en la solicitud {solicitudId}.
              </p>
              <div className="mt-3 flex flex-col gap-3">
                {[...porTipo].map(([tipo, docs]) => (
                  <div key={tipo}>
                    <p className="text-[11px] font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
                      {tipo}
                    </p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {docs.map((d) => (
                        <li key={d.id}>
                          <button
                            type="button"
                            onClick={() => handleOpen(d.id)}
                            disabled={abriendo === d.id}
                            className="flex items-start gap-1.5 text-left text-xs text-neutral-700 underline underline-offset-2 hover:text-brand-deep disabled:opacity-50 dark:text-neutral-300 dark:hover:text-brand-primary"
                          >
                            <FileText size={13} className="mt-0.5 shrink-0" />
                            <span className="break-all">{d.nombre}</span>
                            {abriendo === d.id && <Loader2 size={12} className="mt-0.5 shrink-0 animate-spin" />}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}

          {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
