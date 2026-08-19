import Link from "next/link";
import { BadgeCheck, Layers, MapPin, Zap, Boxes } from "lucide-react";
import type { OwnerPortfolio } from "@/lib/data-access/ownerPortfolio";
import { formatDateOnly } from "@/lib/shared/formatDateOnly";
import { lightDark, PRINCIPAL_COLOR, techColor } from "@/lib/shared/chartColors";
import { technologyDisplayName } from "@/lib/shared/technologyLabel";
import type { MarketTechCategory } from "@/lib/shared/marketTechCategories";
import type { AppLocale } from "@/lib/i18n";
import { localizedRoute } from "@/lib/localizedRoutes";
import { Panel } from "../components/Panel";

/**
 * La cartera de la empresa: lo que sí se puede afirmar con la data de hoy.
 *
 * No hay red societaria porque `company_shareholding` está vacía — ninguna
 * participación accionaria registrada. Lo que sí existe es la cartera de
 * proyectos y las SPV que declaran a esta empresa como matriz, y eso es lo que
 * se muestra. Cuando se integre la API de sociedades, la red va arriba de esto,
 * no en lugar de esto.
 */
/**
 * Los KPI van en turquesa de marca, no en la paleta categórica: el manual
 * reserva el turquesa para "información principal" y los colores por tecnología
 * para tecnología. Pintar un KPI de amarillo lo haría leerse como "Solar" al
 * lado de la tabla de abajo, que sí usa ese amarillo con ese significado.
 */
function Metrica({
  icono,
  valor,
  etiqueta,
  detalle,
}: {
  icono: React.ReactNode;
  valor: string;
  etiqueta: string;
  detalle?: string;
}) {
  return (
    <Panel className="relative overflow-hidden p-4">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: lightDark(PRINCIPAL_COLOR) }}
      />
      <span
        aria-hidden
        className="absolute -top-6 -right-6 h-20 w-20 rounded-full"
        style={{ background: `color-mix(in srgb, ${lightDark(PRINCIPAL_COLOR)} 10%, transparent)` }}
      />
      <div className="relative flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        <span style={{ color: lightDark(PRINCIPAL_COLOR) }}>{icono}</span> {etiqueta}
      </div>
      <p className="relative mt-2 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">{valor}</p>
      {detalle && <p className="relative mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{detalle}</p>}
    </Panel>
  );
}

/** Chip de tecnología con el color canónico de la categoría y el nombre corto. */
function ChipTecnologia({ nombre, categoria }: { nombre: string | null; categoria: MarketTechCategory | null }) {
  if (!nombre) return <span className="text-neutral-400">—</span>;
  const color = lightDark(techColor(categoria));
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden />
      {technologyDisplayName(nombre)}
    </span>
  );
}

export function OwnerPortfolioPanels({
  portfolio,
  companyName,
  similares,
  locale,
}: {
  portfolio: OwnerPortfolio;
  companyName: string;
  /** Empresas cuyo nombre se parece: probables duplicados sin RUT que impiden consolidar. */
  similares: string[];
  locale: AppLocale;
}) {
  const { proyectos, totalMw, verificados, tecnologias, regiones, spvs } = portfolio;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica
          icono={<Boxes size={15} />}
          valor={proyectos.length.toLocaleString("es-CL")}
          etiqueta="Proyectos en cartera"
          detalle={`${verificados.toLocaleString("es-CL")} verificados`}
        />
        <Metrica icono={<Zap size={15} />} valor={`${Math.round(totalMw).toLocaleString("es-CL")} MW`} etiqueta="Potencia identificada" />
        <Metrica icono={<Layers size={15} />} valor={String(tecnologias.length)} etiqueta="Tecnologías" />
        <Metrica icono={<MapPin size={15} />} valor={String(regiones.length)} etiqueta="Regiones" />
      </div>

      {similares.length > 0 && (
        // Se avisa en vez de fusionar: sin RUT no se puede afirmar que dos
        // nombres parecidos sean la misma persona jurídica, y atar empresas
        // equivocadas es más caro que mostrarlas separadas.
        <Panel className="border-amber-300/60 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            <span className="font-semibold">
              {similares.length} {similares.length === 1 ? "empresa con nombre parecido" : "empresas con nombre parecido"}
            </span>{" "}
            podrían ser la misma sociedad, pero no tienen RUT registrado y no se consolidan por nombre:{" "}
            {similares.slice(0, 6).join(" · ")}
            {similares.length > 6 ? ` y ${similares.length - 6} más` : ""}.
          </p>
        </Panel>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_.6fr]">
        <Panel className="flex flex-col gap-4 overflow-hidden">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Cartera de {companyName}</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Proyectos publicados de los que esta empresa figura como desarrolladora, de mayor a menor potencia.
            </p>
          </div>
          {proyectos.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Esta empresa no tiene proyectos publicados en la cartera.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Proyecto</th>
                    <th className="py-2 pr-3 font-medium">Tecnología</th>
                    <th className="py-2 pr-3 text-right font-medium">MW</th>
                    <th className="py-2 pr-3 font-medium">Región</th>
                    <th className="py-2 pr-3 font-medium">Etapa</th>
                    <th className="py-2 pr-3 font-medium">Conexión</th>
                    <th className="py-2 font-medium">Verificado</th>
                  </tr>
                </thead>
                <tbody>
                  {proyectos.slice(0, 25).map((p) => (
                    <tr key={p.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-900">
                      <td className="py-2.5 pr-3">
                        <Link
                          href={`${localizedRoute("projects", locale)}/${p.id}`}
                          className="font-medium text-neutral-900 hover:text-brand-deep dark:text-neutral-50"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3">
                        <ChipTecnologia nombre={p.technology} categoria={p.categoria} />
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                        {p.capacityMw === null ? "—" : p.capacityMw.toLocaleString("es-CL")}
                        {p.capacityMwh !== null ? ` / ${p.capacityMwh.toLocaleString("es-CL")}` : ""}
                      </td>
                      <td className="py-2.5 pr-3 text-neutral-600 dark:text-neutral-400">{p.region ?? "—"}</td>
                      <td className="py-2.5 pr-3 tabular-nums text-neutral-600 dark:text-neutral-400">{p.etapa ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-neutral-600 dark:text-neutral-400">
                        {formatDateOnly(p.estimatedConnectionDate) ?? "—"}
                      </td>
                      <td className="py-2.5">
                        {p.verificado ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-medium"
                            style={{ color: lightDark(PRINCIPAL_COLOR) }}
                          >
                            <BadgeCheck size={14} /> Verificado
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-400">Sin revisar</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {proyectos.length > 25 && (
                <p className="mt-3 text-xs text-neutral-500">
                  Mostrando 25 de {proyectos.length.toLocaleString("es-CL")} proyectos.
                </p>
              )}
            </div>
          )}
        </Panel>

        <Panel className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Sociedades asociadas</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Otras razones sociales que la fuente vincula a esta empresa. Muchas son variantes del mismo nombre o
              cambios de marca, no filiales: no se presentan como propiedad.
            </p>
          </div>
          {spvs.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              La fuente no vincula otras razones sociales a esta empresa.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm text-neutral-700 dark:text-neutral-300">
              {spvs.slice(0, 20).map((s) => (
                <li key={s} className="truncate" title={s}>
                  {s}
                </li>
              ))}
              {spvs.length > 20 && <li className="text-xs text-neutral-500">y {spvs.length - 20} más</li>}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
