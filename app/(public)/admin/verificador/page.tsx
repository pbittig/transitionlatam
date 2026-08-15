import Link from "next/link";
import type { Metadata } from "next";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import {
  getAdminVerificationProgress,
  getVerificationQueue,
  getDoubtfulProjects,
  getVerificationScreeningStats,
  getVerificationPackStats,
  VERIFICATION_PACKS,
  type VerificationQueueItem,
  type VerificationSortColumn,
  type VerificationPack,
  type VerificationScope,
} from "@/lib/data-access/projects";
import { isAdmin } from "@/lib/auth/session";
import { Panel } from "../../components/Panel";
import { DeleteProjectButton } from "../components/DeleteProjectButton";
import { SortableHeader } from "../components/SortableHeader";
import { formatDateOnly } from "@/lib/shared/formatDateOnly";

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

const PACK_ORDER: VerificationPack[] = ["pack1", "pack2", "recover"];

function isPack(value: string | undefined): value is VerificationPack {
  return !!value && (PACK_ORDER as readonly string[]).includes(value);
}

export default async function VerificadorPage({
  searchParams,
}: {
  searchParams: Promise<{ dudosos?: string; sort?: string; dir?: string; pack?: string; scope?: string }>;
}) {
  if (!(await isAdmin())) return null;
  const params = await searchParams;
  const onlyDoubtful = params.dudosos === "1";
  // Pack 1 es el default: es el paquete que se está trabajando. Quien quiera
  // otro lo elige, pero nadie cae por accidente en Recover.
  const pack: VerificationPack = isPack(params.pack) ? params.pack : "pack1";
  const scope: VerificationScope = params.scope === "verificados" ? "verificados" : "pendientes";
  const sortColumn = isSortColumn(params.sort) ? params.sort : undefined;
  const sortDirection: "asc" | "desc" = params.dir === "desc" ? "desc" : "asc";
  const sort = sortColumn ? { column: sortColumn, direction: sortDirection } : undefined;
  // La tabla de pre-verificación contiene evidencia potencialmente sensible y
  // no es legible por anon. Esta página ya validó isAdmin(), por eso consulta
  // server-side con service_role.
  const client = createSupabaseServiceClient();
  const [stats, packStats, queue, progress] = await Promise.all([
    getVerificationScreeningStats(client),
    getVerificationPackStats(client),
    onlyDoubtful
      ? // Los dudosos solo existen entre los que faltan: el tamizado con IA
        // corre sobre la cola pendiente, no sobre lo ya verificado.
        getDoubtfulProjects(client, QUEUE_PAGE_LIMIT, sort, undefined, pack)
      : getVerificationQueue(client, QUEUE_PAGE_LIMIT, sort, undefined, pack, scope),
    getAdminVerificationProgress(client),
  ]);
  const packActual = packStats.find((p) => p.pack === pack);
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

  /** Un solo constructor de URL para no perder el pack al ordenar o filtrar. */
  function buildHref(
    overrides: { pack?: VerificationPack; scope?: VerificationScope; dudosos?: boolean; sort?: string; dir?: "asc" | "desc" } = {},
  ): string {
    const qs = new URLSearchParams();
    const nextPack = overrides.pack ?? pack;
    const nextScope = overrides.scope ?? scope;
    const nextDoubtful = overrides.dudosos ?? onlyDoubtful;
    const nextSort = overrides.sort ?? sortColumn;
    const nextDir = overrides.dir ?? sortDirection;
    if (nextPack !== "pack1") qs.set("pack", nextPack);
    if (nextScope !== "pendientes") qs.set("scope", nextScope);
    if (nextDoubtful) qs.set("dudosos", "1");
    if (nextSort) {
      qs.set("sort", nextSort);
      qs.set("dir", nextDir);
    }
    const query = qs.toString();
    return query ? `/admin/verificador?${query}` : "/admin/verificador";
  }

  function buildCurrentQueueHref(): string {
    return buildHref();
  }

  function buildSortHref(column: string, direction: "asc" | "desc"): string {
    return buildHref({ sort: column, dir: direction });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Verificador de proyecto
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          {VERIFICATION_PACKS[pack].hint}. {packActual?.pendientes.toLocaleString("es-CL") ?? "—"} por verificar y{" "}
          {packActual?.verificados.toLocaleString("es-CL") ?? "—"} ya verificados — mostrando los primeros{" "}
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

        <div className="mt-4 flex flex-wrap gap-1 border-b border-neutral-200 dark:border-neutral-800">
          {PACK_ORDER.map((p) => {
            const s = packStats.find((x) => x.pack === p);
            const activo = p === pack;
            return (
              <Link
                key={p}
                href={buildHref({ pack: p })}
                title={VERIFICATION_PACKS[p].hint}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                  activo
                    ? "border-neutral-900 text-neutral-900 dark:border-neutral-50 dark:text-neutral-50"
                    : "border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                }`}
              >
                {VERIFICATION_PACKS[p].label}
                <span className="ml-1.5 tabular-nums text-xs text-neutral-400">
                  {s ? s.pendientes.toLocaleString("es-CL") : "—"}
                </span>
              </Link>
            );
          })}
        </div>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Se ordenan por fecha de conexión: primero lo que entra antes. No aparecen rechazados ni desistidos — esos
          viven en la <Link href="/admin/boveda" className="underline underline-offset-2">bóveda</Link>.
        </p>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link
            href={buildHref({ scope: "pendientes", dudosos: false })}
            className={`rounded-full border px-3 py-1 font-medium ${
              scope === "pendientes"
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-900"
                : "border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            Por verificar {packActual ? `· ${packActual.pendientes.toLocaleString("es-CL")}` : ""}
          </Link>
          <Link
            href={buildHref({ scope: "verificados", dudosos: false })}
            className={`rounded-full border px-3 py-1 font-medium ${
              scope === "verificados"
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-900"
                : "border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
            title="Repasar fichas ya verificadas — el segundo pase es más rápido"
          >
            Repasar verificados {packActual ? `· ${packActual.verificados.toLocaleString("es-CL")}` : ""}
          </Link>
        </div>

        <div className="mt-2 flex gap-2 text-xs">
          <Link
            href={buildHref({ dudosos: false })}
            className={`rounded-full border px-3 py-1 font-medium ${
              !onlyDoubtful
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-900"
                : "border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            Todos
          </Link>
          <Link
            href={buildHref({ dudosos: true, scope: "pendientes" })}
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

      {/* El avance y la meta diaria son globales, no del pack: cambiar de pestaña
          no debería hacer desaparecer el termómetro del día. */}
      {scope === "pendientes" && <Panel className="grid gap-6 border-brand-primary/25 md:grid-cols-2">
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
              ? `No hay proyectos dudosos tamizados todavía en el ${VERIFICATION_PACKS[pack].label}.`
              : scope === "verificados"
                ? `Todavía no hay nada verificado en el ${VERIFICATION_PACKS[pack].label}.`
                : `El ${VERIFICATION_PACKS[pack].label} está al día — no quedan proyectos por verificar.`}
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
                    {formatDateOnly(p.estimatedConnectionDate) ?? "—"}
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
