import Link from "next/link";
import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { getReverificationQueue } from "@/lib/data-access/projects";
import { Panel } from "../../components/Panel";
import { confirmReverification, sendBackToVerification } from "../reverificationActions";

export const metadata: Metadata = { title: "Revisión de casos dudosos — Admin" };
export const dynamic = "force-dynamic";

export default async function RevisionDudososPage() {
  if (!(await isAdmin())) return null;
  const client = createSupabaseServiceClient();
  const queue = await getReverificationQueue(client);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Revisión de casos dudosos
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Proyectos marcados para que los mires antes de darlos por buenos. Dos casos llegan acá: los que ya
          verificaste y cuyo estado cambió de forma sospechosa en una corrida posterior del sync (retrocedió de
          madurez o pasó a rechazado/desistido), y los que tienen un dato que sabemos que falta o que se quitó por
          ser falso. El motivo de cada uno está en la columna correspondiente. Si el proyecto no estaba verificado,
          &ldquo;Enviar a re-verificar&rdquo; solo saca la marca: ya estaba en la cola del Verificador.
        </p>
      </div>

      {queue.length === 0 ? (
        <Panel>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">No hay casos dudosos pendientes de revisar.</p>
        </Panel>
      ) : (
        <Panel className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3">Proyecto</th>
                <th className="px-4 py-3">Comuna / Región</th>
                <th className="px-4 py-3">Estado actual</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {queue.map((item) => (
                <tr key={item.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-900">
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-900 dark:text-neutral-50">
                      <span className="mr-1" title="Requiere re-verificación">
                        ⚠️
                      </span>
                      {item.name}
                    </p>
                    <p className="text-xs text-neutral-500">{item.internalCode}</p>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {[item.comuna, item.region].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{item.status ?? "—"}</td>
                  <td className="px-4 py-3 max-w-xs text-xs text-neutral-500">{item.reverificationReason}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-2">
                      <Link
                        href={`/admin/verificador/${item.id}`}
                        className="text-sm font-medium text-neutral-700 underline underline-offset-2 hover:text-brand-primary dark:text-neutral-300"
                      >
                        Ver ficha
                      </Link>
                      <div className="flex items-center gap-3">
                        <form action={confirmReverification.bind(null, item.id)}>
                          <button className="text-xs text-emerald-600 hover:underline">Confirmar cambio</button>
                        </form>
                        <form action={sendBackToVerification.bind(null, item.id)}>
                          <button className="text-xs text-amber-600 hover:underline">Enviar a re-verificar</button>
                        </form>
                      </div>
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
