"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PHASE_GROUPS, PHASE_GROUP_LABELS } from "@/lib/shared/projectPhaseDurations";

export function EtapaFilter({ basePath }: { basePath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("etapa") ?? "";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("etapa", value);
    else params.delete("etapa");
    params.delete("page");
    const query = params.toString();
    router.replace(query ? `${basePath}?${query}` : basePath, { scroll: false });
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="etapa" className="text-sm text-neutral-600 dark:text-neutral-400">
        Etapa estimada:
      </label>
      <select
        id="etapa"
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
      >
        <option value="">Todas las etapas</option>
        {PHASE_GROUPS.map((g) => (
          <option key={g} value={g}>
            {PHASE_GROUP_LABELS[g]}
          </option>
        ))}
      </select>
    </div>
  );
}
