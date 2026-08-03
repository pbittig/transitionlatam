import type { Metadata } from "next";
import { CircleCheck, CircleX, Clock3 } from "lucide-react";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { listCronRuns } from "@/lib/data-access/cronRunLog";

export const metadata: Metadata = { title: "Logs de automatización — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminLogsPage() {
  if (!(await isAdmin())) return null;
  const runs = await listCronRuns(createSupabaseServiceClient());

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">Automatización</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Historial persistente de sincronizaciones, avance de lotes y errores operativos.
        </p>
      </div>

      {runs.length === 0 ? (
        <p className="border-y border-neutral-200 py-5 text-sm text-neutral-500 dark:border-neutral-800">
          Aún no hay ejecuciones registradas.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="py-3 pr-4">Job</th>
                <th className="py-3 pr-4">Resultado</th>
                <th className="px-4 py-3">Inicio</th>
                <th className="px-4 py-3">Duración</th>
                <th className="px-4 py-3">Lote</th>
                <th className="px-4 py-3">Avance</th>
                <th className="px-4 py-3">Cambios</th>
                <th className="py-3 pl-4">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b border-neutral-100 align-top dark:border-neutral-900">
                  <td className="py-4 pr-4">
                    <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs dark:bg-neutral-800">
                      {run.jobName === "sync-listado-local" ? "sync-listado (local)" : run.jobName}
                    </span>
                  </td>
                  <td className="py-4 pr-4">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      {run.status === "success" ? (
                        <CircleCheck size={16} className="text-brand-deep" />
                      ) : run.status === "error" ? (
                        <CircleX size={16} className="text-red-600" />
                      ) : (
                        <Clock3 size={16} className="text-neutral-400" />
                      )}
                      {run.status === "success" ? "Correcto" : run.status === "error" ? "Error" : "Ejecutando"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-neutral-600 dark:text-neutral-400">
                    {new Date(run.startedAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "medium" })}
                  </td>
                  <td className="px-4 py-4">{run.durationMs === null ? "—" : `${(run.durationMs / 1000).toFixed(1)} s`}</td>
                  <td className="px-4 py-4">{run.batchSize ?? "—"}</td>
                  <td className="px-4 py-4">
                    {run.processedInCycle ?? 0} procesados
                    <span className="block text-xs text-neutral-500">{run.remainingRows ?? 0} restantes</span>
                  </td>
                  <td className="px-4 py-4">
                    {(run.projectsCreated ?? 0) + (run.projectsUpdated ?? 0)} proyectos
                    {(run.priorityNewRows ?? 0) > 0 && (
                      <span className="block text-xs text-brand-deep">{run.priorityNewRows} solicitudes nuevas detectadas</span>
                    )}
                  </td>
                  <td className="py-4 pl-4 text-xs text-neutral-500">
                    {run.errorMessage ?? (run.cycleComplete ? "Ciclo completo" : `${run.requestsDiscarded ?? 0} solicitudes consolidadas`)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
