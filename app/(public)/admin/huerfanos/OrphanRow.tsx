"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  quitarVinculoHuerfano,
  reasignarVinculoAEmpresa,
  buscarEmpresas,
  type EmpresaCandidata,
} from "../huerfanosActions";

/**
 * Una fila de vínculo huérfano, con las dos salidas posibles: reapuntarlo a una
 * empresa existente o quitarlo.
 *
 * La búsqueda no es un desplegable con las 886 empresas: se escribe y se pide
 * al servidor desde 3 letras. Un select con todas obligaría a bajarlas enteras
 * en cada carga de la página para usar, como mucho, una.
 */
export function OrphanRow({
  id,
  descripcion,
  permiteReasignar,
}: {
  id: string;
  descripcion: string;
  permiteReasignar: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [candidatas, setCandidatas] = useState<EmpresaCandidata[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function buscar(valor: string) {
    setQuery(valor);
    setError(null);
    if (valor.trim().length < 3) {
      setCandidatas([]);
      return;
    }
    startTransition(async () => setCandidatas(await buscarEmpresas(valor)));
  }

  function asignar(empresa: EmpresaCandidata) {
    setError(null);
    startTransition(async () => {
      const r = await reasignarVinculoAEmpresa(id, empresa.id);
      if (r.success) {
        setHecho(`Reasignado a ${empresa.name}`);
        setCandidatas([]);
        router.refresh();
      } else setError(r.error ?? "No se pudo reasignar.");
    });
  }

  function quitar() {
    setError(null);
    startTransition(async () => {
      const r = await quitarVinculoHuerfano(id);
      if (r.success) {
        setHecho("Vínculo quitado");
        router.refresh();
      } else setError(r.error ?? "No se pudo quitar.");
    });
  }

  if (hecho) {
    return (
      <li className="flex items-center gap-2 border-b border-neutral-100 py-3 text-sm text-neutral-400 last:border-0 dark:border-neutral-900">
        <span className="line-through">{descripcion}</span>
        <span className="text-xs text-emerald-600 dark:text-emerald-400">{hecho}</span>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 border-b border-neutral-100 py-3 last:border-0 dark:border-neutral-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-neutral-800 dark:text-neutral-200">{descripcion}</span>
        <div className="flex items-center gap-3">
          {pending && <Loader2 size={13} className="animate-spin text-neutral-400" />}
          <button
            type="button"
            onClick={quitar}
            disabled={pending}
            className="text-xs font-medium text-red-600 underline underline-offset-2 hover:text-red-700 disabled:opacity-50 dark:text-red-400"
          >
            Quitar vínculo
          </button>
        </div>
      </div>

      {permiteReasignar && (
        <div className="flex flex-col gap-1">
          <input
            type="text"
            value={query}
            onChange={(e) => buscar(e.target.value)}
            placeholder="Buscar empresa por nombre o RUT para reasignar…"
            className="h-8 w-full max-w-md rounded-lg border border-neutral-300 bg-transparent px-3 text-xs outline-none focus:border-neutral-500 dark:border-neutral-700"
          />
          {candidatas.length > 0 && (
            <ul className="max-w-md rounded-lg border border-neutral-200 dark:border-neutral-800">
              {candidatas.map((c) => (
                <li key={c.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-900">
                  <button
                    type="button"
                    onClick={() => asignar(c)}
                    disabled={pending}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-800"
                  >
                    {c.name} <span className="text-neutral-400">{c.rut ?? "sin RUT"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </li>
  );
}
