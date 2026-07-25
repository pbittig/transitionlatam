"use client";

import { useState } from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { markProjectVerified } from "../projectEditActions";

export function VerifyButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await markProjectVerified(projectId);
      if (result.success) {
        router.push(result.nextProjectId ? `/admin/verificador/${result.nextProjectId}` : "/admin/verificador");
      } else {
        setError(result.error ?? "Error desconocido al verificar proyecto");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        <CheckCircle2 size={16} /> {pending ? "Guardando…" : "Verificado"}
      </button>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
