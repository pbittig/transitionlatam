"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { PHASE_GROUPS, PHASE_GROUP_LABELS, type PhaseGroup } from "@/lib/shared/projectPhaseDurations";
import { TECH_CHIPS } from "./techChips";

const TECHNOLOGIES = TECH_CHIPS.filter((chip) => !["termica", "transmision"].includes(chip.key));

function parseValues(value: string | null): string[] {
  return value?.split(",").filter(Boolean) ?? [];
}

export function AnalysisMultiFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedTechnologies = parseValues(searchParams.get("tech"));
  const selectedStages = parseValues(searchParams.get("etapa"));

  function toggle(param: "tech" | "etapa", value: string, current: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    if (next.length > 0) params.set(param, next.join(","));
    else params.delete(param);
    const query = params.toString();
    router.replace(query ? `/analisis-dinamico?${query}` : "/analisis-dinamico", { scroll: false });
  }

  return (
    <div className="relative grid gap-3 md:grid-cols-2">
      <FilterGroup title="Tecnologías" emptyLabel="Todas las tecnologías">
        {TECHNOLOGIES.map((technology) => {
          const active = selectedTechnologies.includes(technology.key);
          return (
            <button
              key={technology.key}
              type="button"
              aria-pressed={active}
              onClick={() => toggle("tech", technology.key, selectedTechnologies)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "border-brand-deep bg-brand-deep text-white dark:border-brand-primary dark:bg-brand-primary dark:text-brand-ink"
                  : "border-neutral-200 bg-white text-neutral-600 hover:border-brand-primary hover:text-brand-deep dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
              }`}
            >
              {active && <Check size={13} />}
              {technology.label}
            </button>
          );
        })}
      </FilterGroup>

      <FilterGroup title="Etapas estimadas" emptyLabel="Todas las etapas">
        {PHASE_GROUPS.map((stage) => {
          const active = selectedStages.includes(stage);
          return (
            <button
              key={stage}
              type="button"
              aria-pressed={active}
              onClick={() => toggle("etapa", stage, selectedStages)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "border-brand-deep bg-brand-deep text-white dark:border-brand-primary dark:bg-brand-primary dark:text-brand-ink"
                  : "border-neutral-200 bg-white text-neutral-600 hover:border-brand-primary hover:text-brand-deep dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
              }`}
            >
              {active && <Check size={13} />}
              {PHASE_GROUP_LABELS[stage as PhaseGroup]}
            </button>
          );
        })}
      </FilterGroup>
    </div>
  );
}

function FilterGroup({
  title,
  emptyLabel,
  children,
}: {
  title: string;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-brand-primary/20 bg-white p-4 shadow-sm dark:bg-neutral-950">
      <div className="mb-3">
        <p className="text-sm font-semibold text-neutral-900 dark:text-white">{title}</p>
        <p className="text-xs text-neutral-500">{emptyLabel} si no seleccionas opciones.</p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
