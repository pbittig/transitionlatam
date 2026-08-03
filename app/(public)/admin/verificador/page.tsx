import Link from "next/link";
import type { Metadata } from "next";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import {
  getAdminVerificationProgress,
  getVerificationQueue,
  getDoubtfulProjects,
  getVerificationScreeningStats,
  getVerificationPeriodStats,
  type VerificationQueueItem,
  type VerificationSortColumn,
  type VerificationPeriod,
} from "@/lib/data-access/projects";
import { isAdmin } from "@/lib/auth/session";
import { Panel } from "../../components/Panel";
import { DeleteProjectButton } from "../components/DeleteProjectButton";
import { SortableHeader } from "../components/SortableHeader";

export const metadata: Metadata = { title: "Verificador de proyecto" };
export const dynamic = "force-dynamic";

const QUEUE_PAGE_LIMIT = 100;

const SORT_COLUMNS = ["name", "capacityMw", "estimatedConnectionDate", "status"] as const;

function isSortColumn(value: string | undefined): value is VerificationSortColumn {
  return !!value && (SORT_COLUMNS as readonly string[]).includes(value);
}

function isDoubtful(item: VerificationQueueItem): boolean {
  return item.aiDataSanity === "sospechoso" || item.aiSeiaPick !== null;
}

export default async function VerificadorPage({
  searchParams,
}: {
  searchParams: Promise<{ dudosos?: string; sort?: string; dir?: string; periodo?: string }>;
}) {
  if (!(await isAdmin())) return null;
  const params = await searchParams;
  const onlyDoubtful = params.dudosos === "1";
  const period: VerificationPeriod = params.periodo === "historico" ? "historico" : "vigente";
  const sortColumn = isSortColumn(params.sort) ? params.sort : undefined;
  const sortDirection: "asc" | "desc" = params.dir === "desc" ? "desc" : "asc";
  const sort = sortColumn ? { column: sortColumn, direction: sortDirection } : undefined;
  // La tabla de pre-verificación contiene evidencia potencialmente sensible y
  // no es legible por anon. Esta página ya validó isAdmin(), por eso consulta
  // server-side con service_role.
  const client = createSupabaseServiceClient();
  const [stats, periodStats, queue, progress] = await Promise.all([
    getVerificationScreeningStats(client),
    getVerificationPeriodStats(client),
    onlyDoubtful
      ? getDoubtfulProjects(client, QUEUE_PAGE_LIMIT, sort, period)
      : getVerificationQueue(client, QUEUE_PAGE_LIMIT, sort, period),
    getAdminVerificationProgress(client),
  ]);
  const queueIds = queue.map((project) => project.id);
  const { data: preverificationRows, error: preverificationError } = queueIds.length
    ? await client
        .from("project_preverification")
        .select("project_id")
        .in("project_id", queueIds)
        .in("status", ["completed", "partial"])
    : { data: [], error: null };
  if (preverificationError) {
    throw new Error(`Error obteniendo pre-verificaciones: ${preverificationError.message}`);
  }
  const preverifiedIds = new Set((preverificationRows ?? []).map((row) => row.project_id as string));
  const currentQueueHref = buildCurrentQueueHref();
  const totalProgressPct = progress.total > 0 ? Math.round((progress.verified / progress.total) * 100) : 0;
  const dailyGoal = 50;
  const dailyProgressPct = Math.min(100, Math.round((progress.verifiedToday / dailyGoal) * 100));

  function buildCurrentQueueHref(): string {
    const qs = new URLSearchParams();
    if (period === "historico") qs.set("periodo", "historico");
    if (onlyDoubtful) qs.set("dudosos", "1");
    if (sortColumn) {
      qs.set("sort", sortColumn);
      qs.set("dir", sortDirection);
    }
    const query = qs.toString();
    return query ? `/admin/verificador?${query}` : "/admin/verificador";
  }

  function buildSortHref(column: string, direction: "asc" | "desc"): string {
    const qs = new URLSearchParams();
    qs.set("periodo", period);
    if (onlyDoubtful) qs.set("dudosos", "1");
    qs.set("sort", column);
    qs.set("dir", direction);
    return `/admin/verificador?${qs.toString()}`;
  }

  function buildTabHref(overrides: { periodo?: VerificationPeriod; dudosos?: boolean }): string {
    const qs = new URLSearchParams();
    const nextPeriod = overrides.periodo ?? period;
    const nextDoubtful = overrides.dudosos ?? onlyDoubtful;
    if (nextPeriod === "historico") qs.set("periodo", "historico");
    if (nextDoubtful) qs.set("dudosos", "1");
    if (sortColumn) {
      qs.set("sort", sortColumn);
      qs.set("dir", sortDirection);
    }
    const query = qs.toString();
    return query ? `/admin/verificador?${query}` : "/admin/verificador";
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Verificador de proyecto
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          {periodStats.vigentePending.toLocaleString("es-CL")} vigentes y{" "}
          {periodStats.historicoPending.toLocaleString("es-CL")} históricos pendientes — mostrando los primeros{" "}
          {queue.length.toLocaleString("es-CL")}
          {onlyDoubtful ? ", solo dudosos" : ""}.
        </p>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {stats.screened.toLocaleString("es-CL")} proyectos tamizados con IA en total — {stats.doubtful.toLocaleString("es-CL")}{" "}
          dudosos pendientes de revisar.
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
          Pre-verificado con IA y listo para revisión humana.
        </p>

        <div className="mt-4 flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
          <Link
            href={buildTabHref({ periodo: "vigente" })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              period === "vigente"
                ? "border-neutral-900 text-neutral-900 dark:border-neutral-50 dark:text-neutral-50"
                : "border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            Vigentes
          </Link>
          <Link
            href={buildTabHref({ periodo: "historico" })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              period === "historico"
                ? "border-neutral-900 text-neutral-900 dark:border-neutral-50 dark:text-neutral-50"
                : "border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            Histórico
          </Link>
        </div>
        {period === "vigente" ? (
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            No rechazados/desistidos, desde el día 1 de este mes en adelante — verificar hoy.
          </p>
        ) : (
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Rechazados, desistidos, vencidos o sin fecha — se puede dejar para después, con más gente.
          </p>
        )}

        <div className="mt-3 flex gap-2 text-xs">
          <Link
            href={buildTabHref({ dudosos: false })}
            className={`rounded-full border px-3 py-1 font-medium ${
              !onlyDoubtful
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-900"
                : "border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            Todos
          </Link>
          <Link
            href={buildTabHref({ dudosos: true })}
            className={`rounded-full border px-3 py-1 font-medium ${
              onlyDoubtful
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-900"
                : "border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            Solo dudosos
          </Link>
        </div>
      </div>

      {period === "vigente" && <Panel className="grid gap-6 border-brand-primary/25 md:grid-cols-2">
        <div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-brand-deep dark:text-brand-primary">Avance total</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                {progress.verified.toLocaleString("es-CL")} de {progress.total.toLocaleString("es-CL")} proyectos verificados
              </p>
            </div>
            <span className="text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">{totalProgressPct}%</span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
            <div className="h-full rounded-full bg-brand-primary transition-[width]" style={{ width: `${totalProgressPct}%` }} />
          </div>
        </div>
        <div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-brand-deep dark:text-brand-primary">Meta diaria · 50</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                {progress.verifiedToday.toLocaleString("es-CL")} verificados hoy · faltan{" "}
                {Math.max(0, dailyGoal - progress.verifiedToday).toLocaleString("es-CL")}
              </p>
            </div>
            <span className="text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">{dailyProgressPct}%</span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
            <div className="h-full rounded-full bg-data-solar transition-[width]" style={{ width: `${dailyProgressPct}%` }} />
          </div>
        </div>
        <p className="text-xs text-neutral-500 md:col-span-2">
          Alcance de esta primera etapa: solo proyectos que pasan el prefiltro de generación renovable, híbridos renovables o BESS.
        </p>
      </Panel>}

      {queue.length === 0 ? (
        <Panel>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {onlyDoubtful
              ? "No hay proyectos dudosos tamizados todavía en esta cola."
              : period === "vigente"
                ? "No quedan proyectos vigentes pendientes de verificar."
                : "No quedan proyectos históricos pendientes de verificar."}
          </p>
        </Panel>
      ) : (
        <Panel className="overflow-x-auto p-0">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-neutral-200 text-left text-xs font-medium text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
              <tr>
                <SortableHeader label="Proyecto" column="name" activeColumn={sortColumn} activeDirection={sortDirection} buildHref={buildSortHref} />
                <th className="px-4 py-3 font-medium">Comuna / Región</th>
                <SortableHeader
                  label="Fecha conexión"
                  column="estimatedConnectionDate"
                  activeColumn={sortColumn}
                  activeDirection={sortDirection}
                  buildHref={buildSortHref}
                />
                <SortableHeader label="Estado" column="status" activeColumn={sortColumn} activeDirection={sortDirection} buildHref={buildSortHref} />
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {queue.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900"
                >
                  <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-50">
                    {preverifiedIds.has(p.id) && (
                      <>
                        <span
                          title="Pre-verificado con IA; pendiente de revisión humana"
                          className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 align-middle"
                          aria-hidden="true"
                        />
                        <span className="sr-only">Pre-verificado con IA. </span>
                      </>
                    )}
                    {isDoubtful(p) && (
                      <span title="La IA marcó este proyecto para revisar" className="mr-1">
                        ⚠️
                      </span>
                    )}
                    {p.name}
                    <div className="mt-0.5 text-xs font-normal text-neutral-400 dark:text-neutral-500">
                      {p.internalCode}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {[p.comuna, p.region].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {p.estimatedConnectionDate ? new Date(p.estimatedConnectionDate).toLocaleDateString("es-CL") : "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{p.status ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                    <Link
                      href={`/admin/verificador/${p.id}`}
                      className="text-sm font-medium text-neutral-700 underline underline-offset-2 hover:text-brand-primary dark:text-neutral-300"
                    >
                      Revisar
                    </Link>
                    <DeleteProjectButton projectId={p.id} backHref={currentQueueHref} compact />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
