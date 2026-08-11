import Link from "next/link";
import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { getPertinenciasQueue, clasificarConclusionPertinencia, type PertinenciaTab } from "@/lib/data-access/pertinencias";
import { Panel } from "../../components/Panel";
import { confirmPertinenciaMatch, rejectPertinenciaMatch, markPertinenciaNoMatch } from "../pertinenciaActions";
import { formatRutForDisplay } from "@/lib/shared/formatRut";

export const metadata: Metadata = { title: "Pertinencias SEA — Admin" };
export const dynamic = "force-dynamic";

const TABS: Array<{ key: PertinenciaTab; label: string }> = [
  { key: "pending", label: "Por revisar" },
  { key: "verified", label: "Ya verificado" },
  { key: "confirmed", label: "Confirmadas" },
  { key: "rejected", label: "Rechazadas" },
  { key: "no_match_available", label: "Sin proyecto" },
];

export default async function PertinenciasPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  if (!(await isAdmin())) return null;
  const params = await searchParams;
  const tab = (TABS.find((t) => t.key === params.tab)?.key ?? "pending") as PertinenciaTab;

  const client = createSupabaseServiceClient();
  const queue = await getPertinenciasQueue(client, tab);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Pertinencias SEA</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Consultas de Pertinencia del SEA relacionadas con renovables/BESS — señal temprana de proyectos que podrían
          ingresar a SEIA. El match con un proyecto existente se sugiere por RUT del titular (si coincide con la empresa
          desarrolladora) o, si no, por similitud de nombre — nunca automático, siempre confirmar o rechazar. La pestaña
          &quot;Ya verificado&quot; agrupa las pertinencias cuyo proyecto sugerido ya fue verificado antes.
        </p>
      </div>

      <div className="flex gap-2 border-b border-neutral-200 dark:border-neutral-800">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/pertinencias?tab=${t.key}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.key
                ? t.key === "verified"
                  ? "border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-400"
                  : "border-neutral-900 text-neutral-900 dark:border-neutral-50 dark:text-neutral-50"
                : t.key === "verified"
                  ? "border-transparent text-emerald-600/70 hover:text-emerald-700 dark:text-emerald-400/70 dark:hover:text-emerald-400"
                  : "border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {queue.length === 0 ? (
        <Panel>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">No hay pertinencias en esta categoría.</p>
        </Panel>
      ) : (
        <Panel className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3">Pertinencia</th>
                <th className="px-4 py-3">Titular</th>
                <th className="px-4 py-3">Conclusión</th>
                <th className="px-4 py-3">Proyecto sugerido</th>
                <th className="px-4 py-3">Documentos</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {queue.map((item) => (
                <tr
                  key={item.id}
                  className={`border-b align-top last:border-0 ${
                    item.suggestedProjectVerified
                      ? "border-emerald-100 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                      : "border-neutral-100 dark:border-neutral-900"
                  }`}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-900 dark:text-neutral-50">{item.name}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {item.correlativeId} · {[item.comuna, item.region].filter(Boolean).join(", ") || "—"} ·{" "}
                      {item.fechaPresentacion ?? "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {item.titularName ?? "—"}
                    {item.titularRut && (
                      <p className="text-xs text-neutral-400">
                        RUT {formatRutForDisplay(item.titularRut)}
                        {item.suggestedRutMatches && (
                          <span className="ml-1 font-medium text-emerald-600 dark:text-emerald-400">✓ coincide con el proyecto</span>
                        )}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        item.subEstado === "Resuelta - Ingreso al SEIA" || item.estado === "Derivada a SMA"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                          : item.subEstado === "Resuelta - No ingreso al SEIA" ||
                              item.subEstado === "Resuelta - Desistida" ||
                              item.subEstado === "Resuelta - Abandono" ||
                              item.subEstado === "Resuelta - No admitida a tramitación"
                            ? "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                            : "bg-brand-primary/15 text-brand-deep dark:text-brand-primary"
                      }`}
                    >
                      {clasificarConclusionPertinencia(item.estado, item.subEstado)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {item.suggestedProjectName ? (
                      <>
                        <Link
                          href={`/proyectos/${item.suggestedProjectId}`}
                          target="_blank"
                          className="font-medium text-neutral-900 underline underline-offset-2 hover:text-brand-primary dark:text-neutral-50"
                        >
                          {item.suggestedProjectName}
                        </Link>
                        {item.suggestedProjectVerified && (
                          <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            verificado
                          </span>
                        )}
                        <p className="text-xs text-neutral-500">
                          {item.suggestedRutMatches ? "coincide por RUT" : `similitud de nombre ${item.suggestedMatchScore}%`}
                        </p>
                      </>
                    ) : (
                      <span className="text-xs text-neutral-400">Sin candidato</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {item.documentos.length === 0 ? (
                      <span className="text-xs text-neutral-400">—</span>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {item.documentos.map((d, i) => (
                          <li key={i}>
                            <a
                              href={d.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-neutral-600 underline underline-offset-2 hover:text-brand-primary dark:text-neutral-400"
                            >
                              {d.nombre}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {(tab === "pending" || tab === "verified") && (
                      <div className="flex flex-col items-start gap-2">
                        {item.suggestedProjectId && (
                          <form action={confirmPertinenciaMatch.bind(null, item.id, item.suggestedProjectId)}>
                            <button className="text-xs text-emerald-600 hover:underline">Confirmar match</button>
                          </form>
                        )}
                        <form action={rejectPertinenciaMatch.bind(null, item.id)}>
                          <button className="text-xs text-amber-600 hover:underline">Rechazar sugerencia</button>
                        </form>
                        <form action={markPertinenciaNoMatch.bind(null, item.id)}>
                          <button className="text-xs text-neutral-500 hover:underline">Sin proyecto asociado</button>
                        </form>
                      </div>
                    )}
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
