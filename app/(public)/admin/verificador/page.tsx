import Link from "next/link";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import {
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
  const client = await createSupabaseServerClient();
  const [stats, periodStats, queue] = await Promise.all([
    getVerificationScreeningStats(client),
    getVerificationPeriodStats(client),
    onlyDoubtful
      ? getDoubtfulProjects(client, QUEUE_PAGE_LIMIT, sort, period)
      : getVerificationQueue(client, QUEUE_PAGE_LIMIT, sort, period),
  ]);

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
            <thead className="border-b border-neutral-200 text-left text-xs font-medium tracking-wide text-neutral-500 uppercase dark:border-neutral-800 dark:text-neutral-400">
              <tr>
                <SortableHeader label="Proyecto" column="name" activeColumn={sortColumn} activeDirection={sortDirection} buildHref={buildSortHref} />
                <th className="px-4 py-3 font-medium">Comuna / Región</th>
                <SortableHeader
                  label="MW"
                  column="capacityMw"
                  activeColumn={sortColumn}
                  activeDirection={sortDirection}
                  buildHref={buildSortHref}
                  align="right"
                />
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
                    {isDoubtful(p) && (
                      <span title="La IA marcó este proyecto para revisar" className="mr-1">
                        ⚠️
                      </span>
                    )}
                    {p.name}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {[p.comuna, p.region].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                    {p.capacityMw !== null ? Math.round(p.capacityMw).toLocaleString("es-CL") : "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {p.estimatedConnectionDate ? new Date(p.estimatedConnectionDate).toLocaleDateString("es-CL") : "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{p.status ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/verificador/${p.id}`}
                      className="text-sm font-medium text-neutral-700 underline underline-offset-2 hover:text-brand-primary dark:text-neutral-300"
                    >
                      Revisar
                    </Link>
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
