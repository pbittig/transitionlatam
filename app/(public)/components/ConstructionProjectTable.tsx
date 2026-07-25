import type { ConstructionProjectItem } from "@/lib/data-access/construction";
import { regionToRomanNumeral } from "@/lib/shared/chileRegionRomanNumerals";

export function ConstructionProjectTable({ items }: { items: ConstructionProjectItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin proyectos en construcción.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px] text-sm">
        <thead className="border-b border-neutral-200 text-left text-xs font-medium tracking-wide text-neutral-500 uppercase dark:border-neutral-800 dark:text-neutral-400">
          <tr>
            <th className="px-4 py-3 font-medium">Proyecto</th>
            <th className="px-4 py-3 font-medium">Propietario</th>
            <th className="px-4 py-3 font-medium">Tecnología</th>
            <th className="px-4 py-3 font-medium">Región</th>
            <th className="px-4 py-3 text-right font-medium">MW</th>
            <th className="px-4 py-3 font-medium">Fecha estimada interconexión</th>
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
              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                {p.fechaEstimadaInterconexion ? new Date(p.fechaEstimadaInterconexion).toLocaleDateString("es-CL") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
