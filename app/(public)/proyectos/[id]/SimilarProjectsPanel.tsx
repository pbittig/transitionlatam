import Link from "next/link";
import type { SimilarProject } from "@/lib/data-access/projects";

export function SimilarProjectsPanel({ projects }: { projects: SimilarProject[] }) {
  if (projects.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        No encontramos otros proyectos de la misma tecnología con datos suficientes para comparar.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {projects.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-neutral-100 p-3 dark:border-neutral-900"
          >
            <div className="min-w-0">
              <Link href={`/proyectos/${p.id}`} className="truncate font-medium text-neutral-900 hover:underline dark:text-neutral-50">
                {p.name}
              </Link>
              <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                {[p.region, p.capacityMw ? `${p.capacityMw} MW` : null, p.status].filter(Boolean).join(" · ")}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              {p.similarity}% similar
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
        Similitud determinística (misma tecnología, potencia, región, PMGD/Utility y nivel de tensión) — no un modelo
        de IA. Muestra dónde están hoy proyectos comparables, no cuánto demoraron en tramitarse (no tenemos esa fecha
        real todavía).
      </p>
    </div>
  );
}
