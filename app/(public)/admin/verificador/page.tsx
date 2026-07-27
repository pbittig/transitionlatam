import Link from "next/link";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import {
  getVerificationQueue,
  getDoubtfulProjects,
  getVerificationScreeningStats,
  type VerificationQueueItem,
} from "@/lib/data-access/projects";
import { isAdmin } from "@/lib/auth/session";
import { Panel } from "../../components/Panel";

export const metadata: Metadata = { title: "Verificador de proyecto" };
export const dynamic = "force-dynamic";

const QUEUE_PAGE_LIMIT = 100;

function isDoubtful(item: VerificationQueueItem): boolean {
  return item.aiDataSanity === "sospechoso" || item.aiSeiaPick !== null;
}

export default async function VerificadorPage({
  searchParams,
}: {
  searchParams: Promise<{ dudosos?: string }>;
}) {
  if (!(await isAdmin())) return null;
  const { dudosos } = await searchParams;
  const onlyDoubtful = dudosos === "1";
  const client = await createSupabaseServerClient();
  const [stats, queue] = await Promise.all([
    getVerificationScreeningStats(client),
    onlyDoubtful ? getDoubtfulProjects(client, QUEUE_PAGE_LIMIT) : getVerificationQueue(client, QUEUE_PAGE_LIMIT),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Verificador de proyecto
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          {stats.totalPending.toLocaleString("es-CL")} proyectos pendientes de revisar en total — mostrando los
          primeros {queue.length.toLocaleString("es-CL")}
          {onlyDoubtful ? ", solo dudosos" : ", vigentes primero"}.
        </p>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {stats.screened.toLocaleString("es-CL")} de {stats.totalPending.toLocaleString("es-CL")} ya tamizados con IA
          — {stats.doubtful.toLocaleString("es-CL")} dudosos.
        </p>
        <div className="mt-3 flex gap-2 text-xs">
          <Link
            href="/admin/verificador"
            className={`rounded-full border px-3 py-1 font-medium ${
              !onlyDoubtful
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-900"
                : "border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            Todos
          </Link>
          <Link
            href="/admin/verificador?dudosos=1"
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
              ? "No hay proyectos dudosos tamizados todavía."
              : "No quedan proyectos pendientes de verificar."}
          </p>
        </Panel>
      ) : (
        <Panel className="overflow-x-auto p-0">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-neutral-200 text-left text-xs font-medium tracking-wide text-neutral-500 uppercase dark:border-neutral-800 dark:text-neutral-400">
              <tr>
                <th className="px-4 py-3 font-medium">Proyecto</th>
                <th className="px-4 py-3 font-medium">Comuna / Región</th>
                <th className="px-4 py-3 text-right font-medium">MW</th>
                <th className="px-4 py-3 font-medium">Fecha conexión</th>
                <th className="px-4 py-3 font-medium">Estado</th>
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
