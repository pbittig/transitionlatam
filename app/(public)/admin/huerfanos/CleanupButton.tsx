"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { quitarVinculosDeProyectosBorrados } from "../huerfanosActions";

/**
 * Borra de una vez los vínculos cuyo proyecto ya no existe.
 *
 * Pide confirmación porque son cientos y el borrado no se deshace. No pide
 * más que eso porque no hay decisión que tomar: el proyecto no existe, así que
 * no hay a qué reapuntar el vínculo.
 */
export function CleanupButton({ total }: { total: number }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await quitarVinculosDeProyectosBorrados();
      if (r.success) {
        setResultado(`${(r.borrados ?? 0).toLocaleString("es-CL")} vínculos quitados`);
        setConfirmando(false);
        router.refresh();
      } else setError(r.error ?? "No se pudieron quitar.");
    });
  }

  if (resultado) return <p className="text-sm text-emerald-600 dark:text-emerald-400">{resultado}</p>;

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleClick}
          disabled={pending || total === 0}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
            confirmando
              ? "bg-red-600 text-white hover:bg-red-700"
              : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          }`}
        >
          {pending
            ? "Quitando…"
            : confirmando
              ? `Confirmar: quitar ${total.toLocaleString("es-CL")} vínculos`
              : "Quitar todos"}
        </button>
        {confirmando && !pending && (
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            className="text-xs text-neutral-500 underline underline-offset-2"
          >
            Cancelar
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
