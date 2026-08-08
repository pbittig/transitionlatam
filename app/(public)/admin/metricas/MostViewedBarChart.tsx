import Link from "next/link";
import type { MostViewedProject } from "@/lib/data-access/adminMetrics";

export function MostViewedBarChart({ projects, locale = "es" }: { projects: MostViewedProject[]; locale?: "es" | "en" }) {
  if (projects.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {locale === "en" ? "No project views recorded in the last 90 days." : "No hay vistas de proyecto registradas en los últimos 90 días."}
      </p>
    );
  }

  const max = Math.max(...projects.map((p) => p.views));

  return (
    <div className="flex flex-col gap-2">
      {projects.map((project) => {
        const widthPct = Math.max((project.views / max) * 100, 3);
        return (
          <Link
            key={project.id}
            href={`/proyectos/${project.id}`}
            className="group grid grid-cols-[minmax(0,220px)_1fr_44px] items-center gap-3 rounded-md px-1.5 py-1 hover:bg-neutral-50 dark:hover:bg-neutral-900/60"
          >
            <span className="truncate text-xs font-medium text-neutral-700 group-hover:text-brand-deep dark:text-neutral-300">
              {project.name}
            </span>
            <span className="h-3 overflow-hidden rounded-sm bg-neutral-100 dark:bg-neutral-800">
              <span className="block h-full rounded-sm bg-[#38d7c5]" style={{ width: `${widthPct}%` }} />
            </span>
            <span className="text-right text-xs tabular-nums text-neutral-500 dark:text-neutral-400">{project.views}</span>
          </Link>
        );
      })}
    </div>
  );
}
