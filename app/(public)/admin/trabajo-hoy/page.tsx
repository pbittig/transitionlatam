import Link from "next/link";
import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { getEditorialCounts, getEditorialQueue } from "@/lib/data-access/editorialQueue";
import { Panel } from "../../components/Panel";
import { excludeEditorialProject } from "../editorialActions";

export const metadata: Metadata = { title: "Trabajo de hoy — Admin" };
export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  renewable: "Renovable",
  bess: "BESS",
  uncertain: "Dudoso",
};

export default async function TrabajoHoyPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  if (!(await isAdmin())) return null;
  const scope = (await searchParams).vista === "backlog" ? "backlog" : "today";
  const client = createSupabaseServiceClient();
  const [counts, queue] = await Promise.all([getEditorialCounts(client), getEditorialQueue(client, scope)]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase">Flujo editorial</p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">Trabajo de hoy</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Revisa lo nuevo primero. Solo los proyectos verificados y publicados aparecerán en la plataforma.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Panel><p className="text-xs text-neutral-500">Nuevos de hoy</p><p className="mt-1 text-2xl font-semibold">{counts.today}</p></Panel>
        <Panel><p className="text-xs text-neutral-500">Backlog relevante</p><p className="mt-1 text-2xl font-semibold">{counts.backlog}</p></Panel>
        <Panel><p className="text-xs text-neutral-500">Fuera de alcance</p><p className="mt-1 text-2xl font-semibold">{counts.outOfScope}</p></Panel>
      </div>

      <div className="flex gap-2">
        <Link href="/admin/trabajo-hoy" className={`rounded-full px-3 py-1.5 text-sm ${scope === "today" ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "border border-neutral-300"}`}>Hoy ({counts.today})</Link>
        <Link href="/admin/trabajo-hoy?vista=backlog" className={`rounded-full px-3 py-1.5 text-sm ${scope === "backlog" ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "border border-neutral-300"}`}>Backlog ({counts.backlog})</Link>
      </div>

      {queue.length === 0 ? (
        <Panel><p className="text-sm text-neutral-600">No hay proyectos pendientes en esta bandeja.</p></Panel>
      ) : (
        <Panel className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500 dark:border-neutral-800">
              <tr><th className="px-4 py-3">Proyecto</th><th className="px-4 py-3">Prefiltro</th><th className="px-4 py-3">Pre-verificación</th><th className="px-4 py-3">Detectado</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody>
              {queue.map((item) => (
                <tr key={item.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-900">
                  <td className="px-4 py-3"><p className="font-medium text-neutral-900 dark:text-neutral-50">{item.name}</p><p className="text-xs text-neutral-500">{item.internalCode} · Solicitud {item.externalReference ?? "—"}</p></td>
                  <td className="px-4 py-3"><span className="rounded-full bg-neutral-100 px-2 py-1 text-xs dark:bg-neutral-800">{CATEGORY_LABELS[item.category ?? ""] ?? "Revisar"}</span><p className="mt-1 max-w-xs text-xs text-neutral-500">{item.prefilterReason}</p></td>
                  <td className="px-4 py-3">{item.preverified ? <span className="text-emerald-600">Lista</span> : <span className="text-amber-600">Pendiente</span>}</td>
                  <td className="px-4 py-3 text-neutral-500">{new Date(item.detectedAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><Link href={`/admin/verificador/${item.id}`} className="font-medium underline underline-offset-2">Revisar</Link><form action={excludeEditorialProject.bind(null, item.id)}><button className="text-xs text-red-600 hover:underline">Excluir</button></form></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
