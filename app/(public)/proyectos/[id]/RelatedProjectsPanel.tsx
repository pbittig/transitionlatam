import Link from "next/link";
import type { AppLocale } from "@/lib/i18n";
import type { RelatedPortfolioProject, RelatedProjectReason } from "@/lib/data-access/projects";
import { computeEstimatedPhase } from "@/lib/shared/computeEstimatedPhase";
import { PHASE_GROUP_LABELS, PHASE_TO_GROUP, type PhaseGroup } from "@/lib/shared/projectPhaseDurations";

const relationshipLabels: Record<AppLocale, Record<RelatedProjectReason, string>> = {
  es: {
    same_spv: "Mismo SPV / propietario",
    same_owner: "Mismo desarrollador",
    same_group: "Mismo grupo empresarial",
  },
  en: {
    same_spv: "Same SPV / owner",
    same_owner: "Same developer",
    same_group: "Same corporate group",
  },
};

const phaseLabelsEn: Record<PhaseGroup, string> = {
  temprano: "Early development",
  ingenieria: "Engineering",
  compras: "Procurement",
  construccion: "Construction",
  comisionamiento: "Commissioning / testing",
};

function stageFor(project: RelatedPortfolioProject, locale: AppLocale): string {
  const estimate = computeEstimatedPhase(
    project.estimatedConnectionDate,
    project.technologyCode,
    project.includesStorage,
    project.capacityMw,
  );
  if (!estimate) return locale === "en" ? "Stage unavailable" : "Etapa no disponible";
  if (estimate.pastConnectionDate) return locale === "en" ? "Expected in operation" : "Operación estimada";
  if (!estimate.currentPhase) return locale === "en" ? "Pre-development" : "Pre-desarrollo";
  const group = PHASE_TO_GROUP[estimate.currentPhase];
  return locale === "en" ? phaseLabelsEn[group] : PHASE_GROUP_LABELS[group];
}

export function RelatedProjectsPanel({
  projects,
  locale = "es",
}: {
  projects: RelatedPortfolioProject[];
  locale?: AppLocale;
}) {
  if (projects.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {locale === "en"
          ? "No other verified active projects are currently linked to this owner or corporate group."
          : "No hay otros proyectos activos verificados vinculados a este propietario o grupo empresarial."}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-neutral-100 border-y border-neutral-100 dark:divide-neutral-900 dark:border-neutral-900">
      {projects.map((project) => (
        <li key={project.id} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
          <div className="min-w-0">
            <Link
              href={`/proyectos/${project.id}`}
              className="font-medium text-neutral-900 hover:text-brand-deep dark:text-neutral-50"
            >
              {project.name}
            </Link>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {[
                relationshipLabels[locale][project.reason],
                project.capacityMw !== null ? `${project.capacityMw} MW` : null,
                project.estimatedConnectionDate
                  ? new Date(project.estimatedConnectionDate).toLocaleDateString(locale === "en" ? "en-GB" : "es-CL")
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <span className="w-fit rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            {stageFor(project, locale)}
          </span>
        </li>
      ))}
    </ul>
  );
}
