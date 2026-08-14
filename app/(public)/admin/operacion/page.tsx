import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, CircleX, Clock3, FolderKanban, ShieldCheck, Inbox, ShieldAlert } from "lucide-react";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { getAdminOperationalMetrics, type LatestJobRun } from "@/lib/data-access/adminOperationalMetrics";
import { Panel } from "../../components/Panel";

export const metadata: Metadata = { title: "Operación · Admin" };
export const dynamic = "force-dynamic";

// Un nombre por camino de ejecución, no por script: `sync-listado-local` y
// `preverify-editorial-simulacion` existen para que una corrida que no es la
// del cron no se lea como si lo fuera. Ver la cabecera de preverify-projects.ts.
const JOB_LABELS: Record<string, string> = {
  "sync-listado": "Acceso Abierto (listado, Vercel)",
  "sync-listado-local": "Acceso Abierto (listado)",
  "sync-pgp-progress": "Avance físico PGP",
  "screen-queue": "Tamizado con IA",
  "preverify-editorial": "Pre-verificación editorial",
  "preverify-editorial-simulacion": "Pre-verificación editorial (simulación)",
  "daily-project-report": "Reporte diario por correo",
  "sync-cne-capacidad": "Capacidad instalada CNE",
  "sync-sea-pertinencia": "Pertinencias SEA",
  "compute-schedule-calibration": "Calibración de cronograma",
  "sync-sipub-empresas": "Empresas coordinadas (SIPUB)",
  "sync-sipub-centrales": "Centrales (SIPUB)",
  "sync-sipub-transmision": "Transmisión y subestaciones (SIPUB)",
  "sync-pelp": "Expansión PELP",
  "check-project-visibility": "Qué ve un cliente (control)",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "hace instantes";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Panel className="flex flex-col gap-1">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">{value}</p>
    </Panel>
  );
}

function CoverageBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">{label}</span>
        <span className="tabular-nums text-neutral-500">{count.toLocaleString("es-CL")} · {pct}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div className="h-full rounded-full bg-[#38d7c5]" style={{ width: `${Math.max(pct, 1)}%` }} />
      </div>
    </div>
  );
}

function JobCard({ run, errorCount7d }: { run: LatestJobRun; errorCount7d: number }) {
  const label = JOB_LABELS[run.jobName] ?? run.jobName;
  return (
    <Panel className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{label}</p>
        {run.status === "success" ? (
          <CircleCheck size={16} className="shrink-0 text-brand-deep" />
        ) : run.status === "error" ? (
          <CircleX size={16} className="shrink-0 text-red-600" />
        ) : (
          <Clock3 size={16} className="shrink-0 text-neutral-400" />
        )}
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {run.status === "success" ? "Correcto" : run.status === "error" ? "Con error" : "Ejecutando"} · {timeAgo(run.startedAt)}
        {run.durationMs !== null && ` · ${(run.durationMs / 1000).toFixed(1)} s`}
      </p>
      {run.status === "error" && run.errorMessage && (
        <p className="truncate text-xs text-red-600 dark:text-red-400" title={run.errorMessage}>
          {run.errorMessage}
        </p>
      )}
      {errorCount7d > 0 && (
        <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
          {errorCount7d} {errorCount7d === 1 ? "error" : "errores"} en los últimos 7 días
        </p>
      )}
    </Panel>
  );
}

export default async function AdminOperationsPage() {
  if (!(await isAdmin())) return null;

  const metrics = await getAdminOperationalMetrics(createSupabaseServiceClient());
  const errorsByJob = new Map(metrics.errorsLast7Days.map((e) => [e.jobName, e.count]));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Operación</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Cobertura de datos y salud de las sincronizaciones. Detalle completo de cada corrida en{" "}
          <Link href="/admin/logs" className="underline underline-offset-2">
            /admin/logs
          </Link>
          .
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Proyectos publicados" value={metrics.totalProjects.toLocaleString("es-CL")} />
        <StatTile label="Verificados" value={metrics.verifiedProjects.toLocaleString("es-CL")} />
        <StatTile label="Pendientes de tamizado editorial" value={metrics.editorialPending.toLocaleString("es-CL")} />
        <StatTile label="Casos dudosos por revisar" value={metrics.needsReverification.toLocaleString("es-CL")} />
      </div>

      <Panel>
        <div className="flex items-center gap-2">
          <FolderKanban size={15} className="text-neutral-400" />
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Cobertura de fuentes de datos</h2>
        </div>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          % de los {metrics.totalProjects.toLocaleString("es-CL")} proyectos publicados con antecedente de cada fuente.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <CoverageBar label="Avance físico PGP" count={metrics.coverage.pgp} total={metrics.totalProjects} />
          <CoverageBar label="Expediente SEIA" count={metrics.coverage.seia} total={metrics.totalProjects} />
          <CoverageBar label="Pertinencia SEA confirmada" count={metrics.coverage.pertinencia} total={metrics.totalProjects} />
          <CoverageBar label="Cadena de propiedad mapeada" count={metrics.coverage.ownership} total={metrics.totalProjects} />
        </div>
      </Panel>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <Inbox size={15} className="text-neutral-400" />
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Estado de las sincronizaciones</h2>
        </div>
        {metrics.latestRunPerJob.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Aún no hay ejecuciones registradas.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {metrics.latestRunPerJob.map((run) => (
              <JobCard key={run.jobName} run={run} errorCount7d={errorsByJob.get(run.jobName) ?? 0} />
            ))}
          </div>
        )}
      </div>

      {(metrics.editorialExcluded > 0 || metrics.needsReverification > 0) && (
        <Panel className="border-amber-300/50 dark:border-amber-800/50">
          <div className="flex items-center gap-2">
            <ShieldAlert size={15} className="text-amber-600" />
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Otros indicadores</h2>
          </div>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm text-neutral-600 dark:text-neutral-400">
            {metrics.editorialExcluded > 0 && (
              <li className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-neutral-400" />
                {metrics.editorialExcluded.toLocaleString("es-CL")} proyectos excluidos editorialmente
              </li>
            )}
            {metrics.needsReverification > 0 && (
              <li className="flex items-center gap-1.5">
                <ShieldAlert size={14} className="text-neutral-400" />
                {metrics.needsReverification.toLocaleString("es-CL")} proyectos verificados con cambios sospechosos
              </li>
            )}
          </ul>
        </Panel>
      )}
    </div>
  );
}
