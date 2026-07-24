import Link from "next/link";
import type { ProjectListItem } from "@/lib/data-access/projects";
import type { SeiaRecordForProject } from "@/lib/data-access/seia";
import { regionToRomanNumeral } from "@/lib/shared/chileRegionRomanNumerals";
import { computeHealthScore } from "@/lib/shared/projectHealthScore";
import { ThermalStatusBar } from "./ThermalStatusBar";
import { SeiaStatusBar } from "./SeiaStatusBar";
import { HealthScoreBadge } from "./HealthScoreBadge";
import { AddToCrmButton } from "./AddToCrmButton";

export function ProjectTable({
  items,
  seiaByProjectId,
  admin,
  crmProjectIds,
}: {
  items: ProjectListItem[];
  seiaByProjectId?: Map<string, SeiaRecordForProject>;
  admin: boolean;
  crmProjectIds: Set<string>;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin proyectos para este filtro.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1000px] text-sm">
        <thead className="border-b border-neutral-200 text-left text-xs font-medium tracking-wide text-neutral-500 uppercase dark:border-neutral-800 dark:text-neutral-400">
          <tr>
            <th className="px-4 py-3 font-medium">Proyecto</th>
            <th className="px-4 py-3 font-medium">Empresa</th>
            <th className="px-4 py-3 font-medium">Región</th>
            <th className="px-4 py-3 text-right font-medium">MW</th>
            {seiaByProjectId && <th className="px-4 py-3 font-medium">Estado ambiental (SEIA)</th>}
            <th className="px-4 py-3 font-medium">Estado de proceso de conexión</th>
            <th className="px-4 py-3 font-medium">Fecha conexión</th>
            <th className="px-4 py-3 font-medium" title="Lectura combinada propia del avance del proyecto — no es un dato oficial">
              Health Score
            </th>
            {admin && <th className="px-4 py-3 font-medium">CRM</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((p) => {
            const seia = seiaByProjectId?.get(p.id);
            const health = computeHealthScore(p.status, seia?.status ?? null, p.estimatedConnectionDate);
            return (
              <tr
                key={p.id}
                className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900"
              >
                <td className="px-4 py-3">
                  <Link href={`/proyectos/${p.id}`} className="font-medium text-neutral-900 hover:underline dark:text-neutral-50">
                    {p.name}
                  </Link>
                  {p.includesStorage && !/bess/i.test(p.name) ? (
                    <span
                      className="ml-1 text-xs text-neutral-500 dark:text-neutral-400"
                      title="Este proyecto también incluye un sistema de almacenamiento en baterías (BESS)"
                    >
                      + Almacenamiento (BESS)
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{p.developerCompany ?? "—"}</td>
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400" title={p.region ?? undefined}>
                  {regionToRomanNumeral(p.region) ?? "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                  {p.capacityMw !== null ? Math.round(p.capacityMw).toLocaleString("es-CL") : "—"}
                  {p.includesStorage && p.capacityMwh !== null && (
                    <span className="ml-1 text-xs text-neutral-400 dark:text-neutral-500">
                      · {Math.round(p.capacityMwh).toLocaleString("es-CL")} MWh
                    </span>
                  )}
                </td>
                {seiaByProjectId && (
                  <td className="px-4 py-3">
                    {seia ? (
                      <div>
                        <SeiaStatusBar status={seia.status} submissionType={seia.submissionType} />
                        {seia.titular && (
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{seia.titular}</div>
                        )}
                        {seia.matchConfidence && seia.matchConfidence !== "alta" && (
                          <div className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                            match {seia.matchConfidence}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-neutral-400 dark:text-neutral-500">—</span>
                    )}
                  </td>
                )}
                <td className="px-4 py-3">
                  <ThermalStatusBar status={p.status} compact />
                </td>
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                  {p.estimatedConnectionDate ? new Date(p.estimatedConnectionDate).toLocaleDateString("es-CL") : "—"}
                </td>
                <td className="px-4 py-3">
                  <HealthScoreBadge health={health} compact />
                </td>
                {admin && (
                  <td className="px-4 py-3">
                    <AddToCrmButton
                      projectId={p.id}
                      projectName={p.name}
                      developerCompanyId={p.developerCompanyId}
                      initiallyInCrm={crmProjectIds.has(p.id)}
                      compact
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
