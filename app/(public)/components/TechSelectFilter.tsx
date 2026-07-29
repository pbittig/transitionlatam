"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { TECH_CHIPS } from "./techChips";

export function TechSelectFilter({
  basePath,
  selectedKeys,
  excludeKeys,
}: {
  basePath: string;
  selectedKeys: string[];
  excludeKeys?: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chips = excludeKeys ? TECH_CHIPS.filter((chip) => !excludeKeys.includes(chip.key)) : TECH_CHIPS;
  const current = selectedKeys[0] ?? "";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("tech", value);
    else params.delete("tech");
    params.delete("page");
    const query = params.toString();
    router.replace(query ? `${basePath}?${query}` : basePath, { scroll: false });
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="tech" className="text-sm text-neutral-600 dark:text-neutral-400">
        Tecnología:
      </label>
      <select
        id="tech"
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
      >
        <option value="">Todas las tecnologías</option>
        {chips.map((chip) => (
          <option key={chip.key} value={chip.key}>
            {chip.label}
          </option>
        ))}
      </select>
    </div>
  );
}
