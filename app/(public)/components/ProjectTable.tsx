import Link from "next/link";
import type { ProjectListItem } from "@/lib/data-access/projects";
import type { SeiaRecordForProject } from "@/lib/data-access/seia";
import { computeHealthScore } from "@/lib/shared/projectHealthScore";
import { ThermalStatusBar } from "./ThermalStatusBar";
import { SeiaStatusBar } from "./SeiaStatusBar";
import { HealthScoreBadge } from "./HealthScoreBadge";
import { AddToCrmButton } from "./AddToCrmButton";
import { BatteryCharging, ContactRound, Droplets, Leaf, LockKeyhole, Sun, Wind } from "lucide-react";
import type { AppLocale } from "@/lib/i18n";

export function ProjectTechnologyIcon({ project, locale }: { project: ProjectListItem; locale: AppLocale }) {
  const signal = `${project.technologyCode ?? ""} ${project.technology ?? ""} ${project.name}`.toLowerCase();
  const isStorageOnly = project.projectKind === "storage" || project.technologyCode === "bess";
  const isSolar = /solar|fotovolta/.test(signal);
  const isWind = /wind|eólic|eolic/.test(signal);
  const isHydro = /hydro|hidro/.test(signal);

  const renewableIcon = isSolar ? <Sun size={13} /> : isWind ? <Wind size={13} /> : isHydro ? <Droplets size={13} /> : <Leaf size={13} />;
  const renewableLabel = isSolar ? "Solar" : isWind ? (locale === "en" ? "Wind" : "Eólico") : isHydro ? (locale === "en" ? "Hydropower" : "Hidroeléctrico") : (locale === "en" ? "Renewable" : "Renovable");
  const label = isStorageOnly ? "BESS" : project.includesStorage ? `${renewableLabel} + BESS` : renewableLabel;

  return (
    <span
      title={label}
      aria-label={label}
      className="flex h-8 min-w-8 shrink-0 items-center justify-center gap-0.5 rounded-lg border border-neutral-200 bg-white px-1.5 text-[#333333]"
    >
      {isStorageOnly ? <BatteryCharging size={14} className="text-brand-primary" /> : renewableIcon}
      {!isStorageOnly && project.includesStorage && <BatteryCharging size={12} className="text-brand-primary" />}
    </span>
  );
}

function TablePlanGate({
  children,
  label = "Disponible en plan Prime",
  narrow = false,
}: {
  children: React.ReactNode;
  label?: string;
  narrow?: boolean;
}) {
  return (
    <span className={`group relative inline-grid h-9 overflow-visible rounded-md border border-neutral-200 bg-neutral-50 align-middle ${narrow ? "w-16" : "w-32"}`}>
      <span
        aria-hidden
        className="pointer-events-none col-start-1 row-start-1 flex items-center justify-center overflow-hidden rounded-md opacity-45 blur-[2px]"
      >
        {children}
      </span>
      <span className="absolute inset-0 rounded-md bg-white/58 backdrop-blur-[3px]" />
      <Link
        href="/planes"
        title={label}
        aria-label={`${label}. Ver planes.`}
        className="absolute inset-0 z-[2] rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
      >
        <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 w-max max-w-56 -translate-x-1/2 translate-y-1 rounded-lg bg-[#333333] px-2.5 py-1.5 text-center text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
          {label}
        </span>
      </Link>
    </span>
  );
}

function LockedColumnHeader({ children, locked }: { children: React.ReactNode; locked: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {children}
      {locked && <LockKeyhole size={12} className="text-brand-primary" aria-label="Disponible en un plan superior" />}
    </span>
  );
}

export function ProjectTable({
  items,
  seiaByProjectId,
  crmProjectIds,
  isFree = false,
  locale = "es",
}: {
  items: ProjectListItem[];
  seiaByProjectId?: Map<string, SeiaRecordForProject>;
  crmProjectIds: Set<string>;
  isFree?: boolean;
  locale?: AppLocale;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">{locale === "en" ? "No projects match this filter." : "Sin proyectos para este filtro."}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <p className="px-3 pt-3 text-[10px] text-neutral-400 md:hidden">{locale === "en" ? "Swipe horizontally to review all project signals." : "Desliza horizontalmente para revisar todas las señales del proyecto."}</p>
      <table className="w-full min-w-[940px] text-sm">
        <thead className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50 text-left text-xs font-medium text-neutral-500">
          <tr>
            <th className="px-3 py-3 font-medium">{locale === "en" ? "Project" : "Proyecto"}</th>
            <th className="px-3 py-3 font-medium">{locale === "en" ? "Renewable generation (MW)" : "Renovable (MW)"}</th>
            <th className="px-3 py-3 font-medium">{locale === "en" ? "Battery (MW/MWh)" : "Batería (MW/MWh)"}</th>
            {seiaByProjectId && <th className="px-3 py-3 font-medium"><LockedColumnHeader locked={isFree}>{locale === "en" ? "Environmental status" : "Estado ambiental"}</LockedColumnHeader></th>}
            <th className="px-3 py-3 font-medium"><LockedColumnHeader locked={isFree}>{locale === "en" ? "Connection progress" : "Avance de conexión"}</LockedColumnHeader></th>
            <th className="px-3 py-3 font-medium">{locale === "en" ? "Estimated connection" : "Conexión estimada"}</th>
            <th className="w-20 px-3 py-3 font-medium" title="Health Score estimado según avance, estado ambiental y fecha — no es un dato oficial">
              <LockedColumnHeader locked={isFree}><span className="leading-tight">Health<br />Score</span></LockedColumnHeader>
            </th>
            <th className="w-20 px-3 py-3 font-medium"><LockedColumnHeader locked={isFree}>CRM</LockedColumnHeader></th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => {
            const seia = seiaByProjectId?.get(p.id);
            const health = computeHealthScore(p.status, seia?.status ?? null, p.estimatedConnectionDate, new Date(), {
              projectKind: p.projectKind,
              includesStorage: p.includesStorage,
              seiaSubmissionType: seia?.submissionType,
              generationCapacityMw: p.generationCapacityMw ?? p.capacityMw,
              // No hay voltaje de conexión por fila en esta lista — el umbral de
              // BESS (>23kV) solo se evalúa hoy en la ficha, donde sí se carga.
            });
            return (
              <tr
                key={p.id}
                className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900"
              >
                <td className="px-3 py-3">
                  <div className="flex items-start gap-2.5">
                    <ProjectTechnologyIcon project={p} locale={locale} />
                    <div className="min-w-0">
                      <Link href={`/proyectos/${p.id}`} className="font-medium text-neutral-900 hover:underline dark:text-neutral-50">
                        {p.name}
                      </Link>
                      <div className="text-xs text-neutral-400 dark:text-neutral-500">{p.internalCode}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  {(() => {
                    // Un BESS puro no genera — su "capacidad" es en realidad la de
                    // almacenamiento (ver computeHeadlineCapacity), así que acá no se
                    // muestra nada de generación para no confundirla con la de la otra
                    // columna. Para híbridos, generation_capacity_mw es el dato correcto;
                    // capacityMw queda de respaldo por si un proyecto viejo no lo tiene.
                    const generationMw = p.projectKind === "storage" ? null : (p.generationCapacityMw ?? p.capacityMw);
                    return generationMw !== null ? (
                      <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium tabular-nums text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                        {Math.round(generationMw).toLocaleString("es-CL")}
                      </span>
                    ) : (
                      <span className="text-sm text-neutral-400 dark:text-neutral-500">—</span>
                    );
                  })()}
                </td>
                <td className="px-3 py-3">
                  {(() => {
                    if (!p.includesStorage) return <span className="text-sm text-neutral-400 dark:text-neutral-500">—</span>;
                    // Un BESS puro no tiene generation_capacity_mw, así que su capacityMw
                    // es la potencia de almacenamiento (ver computeHeadlineCapacity) —
                    // se usa como respaldo si storage_capacity_mw todavía no está poblado.
                    const storageMw = p.storageCapacityMw ?? (p.projectKind === "storage" ? p.capacityMw : null);
                    const mwLabel = storageMw !== null ? Math.round(storageMw).toLocaleString("es-CL") : null;
                    const mwhLabel = p.capacityMwh !== null ? Math.round(p.capacityMwh).toLocaleString("es-CL") : null;
                    return mwLabel || mwhLabel ? (
                      <span className="inline-flex items-center whitespace-nowrap rounded-lg bg-brand-primary/15 px-2 py-1 text-xs font-medium tabular-nums text-[#333333]">
                        <span>{mwLabel ?? "—"}/{mwhLabel ?? "—"}</span>
                      </span>
                    ) : (
                      <span className="text-sm text-neutral-400 dark:text-neutral-500">—</span>
                    );
                  })()}
                </td>
                {seiaByProjectId && (
                  <td className="px-3 py-3">
                    {isFree ? (
                      <TablePlanGate label={locale === "en" ? "Environmental status available on Prime" : "Estado ambiental disponible en Prime"}>
                        {seia ? (
                          <SeiaStatusBar status={seia.status} submissionType={seia.submissionType} compact />
                        ) : (
                          <span className="text-sm text-neutral-400">—</span>
                        )}
                      </TablePlanGate>
                    ) : seia ? (
                      <SeiaStatusBar status={seia.status} submissionType={seia.submissionType} compact />
                    ) : (
                      <span className="text-sm text-neutral-400 dark:text-neutral-500">—</span>
                    )}
                  </td>
                )}
                <td className="px-3 py-3">
                  {isFree ? (
                    <TablePlanGate label={locale === "en" ? "Connection progress available on Prime" : "Avance de conexión disponible en Prime"}>
                      <ThermalStatusBar status={p.status} compact showPercentage />
                    </TablePlanGate>
                  ) : (
                    <ThermalStatusBar status={p.status} compact showPercentage />
                  )}
                </td>
                <td className="px-3 py-3 text-neutral-600">
                  {p.estimatedConnectionDate ? (() => {
                    const date = new Date(p.estimatedConnectionDate);
                    return (
                      <time dateTime={p.estimatedConnectionDate} className="inline-flex min-w-14 flex-col leading-none">
                        <span className="text-base font-semibold tracking-tight tabular-nums text-neutral-900">
                          {date.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" })}
                        </span>
                        <span className="mt-1 text-[10px] font-medium tracking-[0.12em] tabular-nums text-neutral-400">
                          {date.getFullYear()}
                        </span>
                      </time>
                    );
                  })() : "—"}
                </td>
                <td className="w-20 px-3 py-3">
                  {isFree ? (
                    <TablePlanGate label={locale === "en" ? "Health Score available on Prime" : "Health Score disponible en Prime"} narrow>
                      <HealthScoreBadge health={health} compact />
                    </TablePlanGate>
                  ) : (
                    <HealthScoreBadge health={health} compact />
                  )}
                </td>
                <td className="w-20 px-3 py-3">
                  {isFree ? (
                    <TablePlanGate label={locale === "en" ? "CRM available on Prime" : "CRM disponible en Prime"} narrow>
                      <ContactRound size={16} className="text-neutral-500" />
                    </TablePlanGate>
                  ) : (
                    <AddToCrmButton
                      projectId={p.id}
                      projectName={p.name}
                      developerCompanyId={p.developerCompanyId}
                      initiallyInCrm={crmProjectIds.has(p.id)}
                      compact
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
