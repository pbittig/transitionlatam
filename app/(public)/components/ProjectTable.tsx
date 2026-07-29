import Link from "next/link";
import type { ProjectListItem } from "@/lib/data-access/projects";
import type { SeiaRecordForProject } from "@/lib/data-access/seia";
import { computeHealthScore } from "@/lib/shared/projectHealthScore";
import { ThermalStatusBar } from "./ThermalStatusBar";
import { SeiaStatusBar } from "./SeiaStatusBar";
import { HealthScoreBadge } from "./HealthScoreBadge";
import { AddToCrmButton } from "./AddToCrmButton";
import { PlanGate } from "./PlanGate";

export function ProjectTable({
  items,
  seiaByProjectId,
  crmProjectIds,
  isFree = false,
}: {
  items: ProjectListItem[];
  seiaByProjectId?: Map<string, SeiaRecordForProject>;
  crmProjectIds: Set<string>;
  isFree?: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin proyectos para este filtro.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <p className="px-4 pt-3 text-[10px] text-neutral-400 md:hidden">Desliza horizontalmente para revisar todas las señales del proyecto.</p>
      <table className="w-full min-w-[1000px] text-sm">
        <thead className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50 text-left text-xs font-medium tracking-wide text-neutral-500 uppercase dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          <tr>
            <th className="px-4 py-3 font-medium">Proyecto</th>
            <th className="px-4 py-3 font-medium">Generación (MW)</th>
            <th className="px-4 py-3 font-medium">Batería (MW/MWh)</th>
            {seiaByProjectId && <th className="px-4 py-3 font-medium">Estado ambiental (SEIA)</th>}
            <th className="px-4 py-3 font-medium">Avance de conexión</th>
            <th className="px-4 py-3 font-medium">Conexión estimada</th>
            <th className="px-4 py-3 font-medium" title="Estimación propia basada en avance, estado ambiental y fecha — no es un dato oficial">
              Probabilidad de cumplir fecha
            </th>
            <th className="px-4 py-3 font-medium">CRM</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => {
            const seia = seiaByProjectId?.get(p.id);
            const health = computeHealthScore(p.status, seia?.status ?? null, p.estimatedConnectionDate, new Date(), {
              projectKind: p.projectKind,
              includesStorage: p.includesStorage,
              seiaSubmissionType: seia?.submissionType,
            });
            return (
              <tr
                key={p.id}
                className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900"
              >
                <td className="px-4 py-3">
                  <Link href={`/proyectos/${p.id}`} className="font-medium text-neutral-900 hover:underline dark:text-neutral-50">
                    {p.name}
                  </Link>
                  <div className="text-xs text-neutral-400 dark:text-neutral-500">{p.internalCode}</div>
                </td>
                <td className="px-4 py-3">
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
                <td className="px-4 py-3">
                  {(() => {
                    if (!p.includesStorage) return <span className="text-sm text-neutral-400 dark:text-neutral-500">—</span>;
                    // Un BESS puro no tiene generation_capacity_mw, así que su capacityMw
                    // es la potencia de almacenamiento (ver computeHeadlineCapacity) —
                    // se usa como respaldo si storage_capacity_mw todavía no está poblado.
                    const storageMw = p.storageCapacityMw ?? (p.projectKind === "storage" ? p.capacityMw : null);
                    const mwLabel = storageMw !== null ? Math.round(storageMw).toLocaleString("es-CL") : null;
                    const mwhLabel = p.capacityMwh !== null ? Math.round(p.capacityMwh).toLocaleString("es-CL") : null;
                    return mwLabel || mwhLabel ? (
                      <span className="bg-brand-primary/15 dark:bg-brand-primary/25 inline-flex items-center whitespace-nowrap rounded-lg px-2 py-1 text-xs font-medium tabular-nums text-blue-900 dark:text-blue-200">
                        <span>{mwLabel ?? "—"}/{mwhLabel ?? "—"}</span>
                      </span>
                    ) : (
                      <span className="text-sm text-neutral-400 dark:text-neutral-500">—</span>
                    );
                  })()}
                </td>
                {seiaByProjectId && (
                  <td className="px-4 py-3">
                    <PlanGate locked={isFree}>
                      {seia ? (
                        <SeiaStatusBar status={seia.status} submissionType={seia.submissionType} compact />
                      ) : (
                        <span className="text-sm text-neutral-400 dark:text-neutral-500">—</span>
                      )}
                    </PlanGate>
                  </td>
                )}
                <td className="px-4 py-3">
                  <PlanGate locked={isFree}>
                    <ThermalStatusBar status={p.status} compact showPercentage />
                  </PlanGate>
                </td>
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                  {p.estimatedConnectionDate ? new Date(p.estimatedConnectionDate).toLocaleDateString("es-CL") : "—"}
                </td>
                <td className="px-4 py-3">
                  <PlanGate locked={isFree}>
                    <HealthScoreBadge health={health} compact />
                  </PlanGate>
                </td>
                <td className="px-4 py-3">
                  <AddToCrmButton
                    projectId={p.id}
                    projectName={p.name}
                    developerCompanyId={p.developerCompanyId}
                    initiallyInCrm={crmProjectIds.has(p.id)}
                    compact
                    locked={isFree}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
