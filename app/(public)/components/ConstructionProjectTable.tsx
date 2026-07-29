import type { ConstructionProjectItem } from "@/lib/data-access/construction";
import { regionToRomanNumeral } from "@/lib/shared/chileRegionRomanNumerals";

export function ConstructionProjectTable({ items }: { items: ConstructionProjectItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin proyectos en construcción.</p>;
  }

  return (
    <>
      <div className="grid gap-3 p-3 md:hidden">
        {items.map((p) => (
          <article key={p.id} className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold leading-snug">{p.proyectoCentral}</h3>
              <span className="shrink-0 rounded-full bg-brand-surface px-2.5 py-1 text-xs font-semibold text-brand-deep dark:text-brand-primary">
                {p.potenciaNetaMw !== null ? `${p.potenciaNetaMw.toLocaleString("es-CL")} MW` : "—"}
              </span>
            </div>
            {p.proyectoBessAsociado && p.proyectoBessAsociado !== p.proyectoCentral && <p className="mt-1 text-xs text-data-bess">+ {p.proyectoBessAsociado}</p>}
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{p.propietario ?? "Propietario sin informar"}</p>
            <div className="mt-3 flex flex-wrap gap-x-2 text-xs text-neutral-500">
              <span>{p.tipoTecnologiaFinal ?? "Tecnología sin informar"}</span><span>·</span><span>Región {regionToRomanNumeral(p.region) ?? "—"}</span>
            </div>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[700px] text-sm">
        <thead className="border-b border-neutral-200 text-left text-xs font-medium tracking-wide text-neutral-500 uppercase dark:border-neutral-800 dark:text-neutral-400">
          <tr>
            <th className="px-4 py-3 font-medium">Proyecto</th>
            <th className="px-4 py-3 font-medium">Propietario</th>
            <th className="px-4 py-3 font-medium">Tecnología</th>
            <th className="px-4 py-3 font-medium">Región</th>
            <th className="px-4 py-3 text-right font-medium">MW</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr
              key={p.id}
              className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900"
            >
              <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-50">
                {p.proyectoCentral}
                {p.proyectoBessAsociado && p.proyectoBessAsociado !== p.proyectoCentral && (
                  <span className="ml-1 text-xs font-normal text-neutral-500 dark:text-neutral-400">
                    + {p.proyectoBessAsociado}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{p.propietario ?? "—"}</td>
              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{p.tipoTecnologiaFinal ?? "—"}</td>
              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400" title={p.region ?? undefined}>
                {regionToRomanNumeral(p.region) ?? "—"}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                {p.potenciaNetaMw !== null ? p.potenciaNetaMw.toLocaleString("es-CL") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}
