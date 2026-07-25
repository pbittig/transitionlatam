"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { markProjectVerified } from "../projectEditActions";

export function VerifyButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await markProjectVerified(projectId);
      if (result.success) {
        router.push(result.nextProjectId ? `/admin/verificador/${result.nextProjectId}` : "/admin/verificador");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
    >
      <CheckCircle2 size={16} /> {pending ? "Guardando…" : "Verificado"}
    </button>
  );
}
