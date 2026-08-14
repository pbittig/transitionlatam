import Link from "next/link";
import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { ESTADOS_CAIDOS, getFallenProjects } from "@/lib/data-access/projects";
import { Panel } from "../../components/Panel";

export const metadata: Metadata = { title: "Bóveda de proyectos caídos — Admin" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function BovedaPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string; pagina?: string }>;
}) {
  if (!(await isAdmin())) return null;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.pagina ?? "1") || 1);
  const client = createSupabaseServiceClient();
  const { items, total } = await getFallenProjects(client, {
    status: sp.estado,
    search: sp.q,
    page,
    pageSize: PAGE_SIZE,
  });

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const linkWith = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const estado = patch.estado !== undefined ? patch.estado : sp.estado;
    const q = patch.q !== undefined ? patch.q : sp.q;
    const pagina = patch.pagina;
    if (estado) p.set("estado", estado);
    if (q) p.set("q", q);
    if (pagina && pagina !== "1") p.set("pagina", pagina);
    const qs = p.toString();
    return qs ? `/admin/boveda?${qs}` : "/admin/boveda";
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Bóveda de proyectos caídos
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Proyectos rechazados o desistidos. Los clientes no los ven —la política de lectura de la base los esconde,
          no la interfaz— pero no se borraron: siguen acá con toda su ficha. Sirven para saber qué se cayó, de quién
          era y dónde, que es justo lo que no se puede reconstruir después.
        </p>
      </div>

      <Panel className="flex flex-col gap-4">
        <form action="/admin/boveda" className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="q" className="text-xs text-neutral-500">
              Buscar por nombre o código
            </label>
            <input
              id="q"
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Ej: Termoeléctrica, TL-0452"
              className="h-9 w-64 rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="estado" className="text-xs text-neutral-500">
              Estado
            </label>
            <select
              id="estado"
              name="estado"
              defaultValue={sp.estado ?? ""}
              className="h-9 rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
            >
              <option value="">Todos</option>
              {ESTADOS_CAIDOS.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
          </div>
          <button className="h-9 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900">
            Filtrar
          </button>
          {(sp.q || sp.estado) && (
            <Link href="/admin/boveda" className="text-sm text-neutral-500 underline underline-offset-2">
              Limpiar
            </Link>
          )}
        </form>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {total.toLocaleString("es-CL")} {total === 1 ? "proyecto" : "proyectos"}
          {sp.q || sp.estado ? " con este filtro" : " en la bóveda"}.
        </p>
      </Panel>

      {items.length === 0 ? (
        <Panel>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">No hay proyectos que coincidan.</p>
        </Panel>
      ) : (
        <Panel className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3">Proyecto</th>
                <th className="px-4 py-3">Comuna / Región</th>
                <th className="px-4 py-3">Tecnología</th>
                <th className="px-4 py-3 text-right">MW</th>
                <th className="px-4 py-3">Desarrollador</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-900">
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-900 dark:text-neutral-50">{item.name}</p>
                    <p className="text-xs text-neutral-500">{item.internalCode}</p>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {[item.comuna, item.region].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{item.technology ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                    {item.capacityMw === null ? "—" : item.capacityMw.toLocaleString("es-CL")}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{item.developer ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs ${
                        item.status === "Rechazada"
                          ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                          : "bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400"
                      }`}
                    >
                      {item.status ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/verificador/${item.id}`}
                      className="text-sm font-medium text-neutral-700 underline underline-offset-2 hover:text-brand-primary dark:text-neutral-300"
                    >
                      Ver ficha
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {lastPage > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-500">
            Página {page} de {lastPage}
          </span>
          <div className="flex gap-3">
            {page > 1 && (
              <Link href={linkWith({ pagina: String(page - 1) })} className="underline underline-offset-2">
                Anterior
              </Link>
            )}
            {page < lastPage && (
              <Link href={linkWith({ pagina: String(page + 1) })} className="underline underline-offset-2">
                Siguiente
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
