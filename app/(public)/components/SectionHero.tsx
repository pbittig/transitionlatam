import { Sparkles } from "lucide-react";

/**
 * La cabecera de sección del portal: un solo bloque oscuro que funde el título,
 * las acciones y los indicadores.
 *
 * Antes cada sección lo resolvía por su cuenta y quedaron tres variantes: la de
 * Proyectos Futuros (todo fundido en un bloque), la de Operación (banda
 * `#082425` pegada abajo) y la de Propietarios (banda suelta, con otro marcado
 * para los indicadores). Este componente es la de Proyectos Futuros, que es la
 * que se dejó como estándar — el resto de las secciones lo usan en vez de
 * recrearla, para que la cabecera no vuelva a divergir.
 */

export interface SectionHeroMetric {
  label: string;
  value: string;
  detail: string;
}

/**
 * Un indicador de la banda. El valor va en blanco y el detalle en turquesa: es
 * la jerarquía del manual de marca, no una decisión por indicador.
 */
function IntelligenceMetric({ label, value, detail }: SectionHeroMetric) {
  return (
    <div className="min-w-[132px] border-l border-white/12 px-4 first:border-l-0 first:pl-0 sm:min-w-[150px]">
      <p className="text-[11px] font-medium text-white/55">{label}</p>
      <p className="mt-1 max-w-[220px] truncate text-xl font-semibold tracking-tight text-white" title={value}>
        {value}
      </p>
      <p className="mt-1 text-[11px] text-[#65e2d3]">{detail}</p>
    </div>
  );
}

export function SectionHero({
  eyebrow,
  title,
  /** Texto secundario en la misma línea del título, más tenue (lo usa ObsX). */
  titleSuffix,
  description,
  /** Botones de la esquina superior derecha. */
  actions,
  metrics = [],
}: {
  eyebrow: string;
  title: string;
  titleSuffix?: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
  metrics?: SectionHeroMetric[];
}) {
  return (
    // Los márgenes negativos cancelan EXACTAMENTE el padding del <main> del
    // layout (px-4 pt-5 / sm:px-7 sm:pt-8), para que la cabecera vaya a sangre
    // y pegada al borde superior. Si ese padding cambia, estos valores cambian
    // con él: de más se asoma fuera del contenido y aparece scroll horizontal,
    // de menos queda una franja blanca alrededor.
    <section className="relative -mx-4 -mt-5 overflow-hidden bg-[#041415] px-5 py-7 text-white shadow-lg sm:-mx-7 sm:-mt-8 sm:px-7 md:rounded-b-3xl lg:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-80 [background:radial-gradient(circle_at_82%_15%,rgba(56,215,197,0.18),transparent_25%),radial-gradient(circle_at_45%_110%,rgba(15,92,89,0.32),transparent_38%)]" />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-[#65e2d3]">
              <Sparkles size={14} /> {eyebrow}
            </div>
            <h1 className="mt-3 flex flex-wrap items-baseline gap-3 text-3xl font-semibold tracking-tight md:text-4xl">
              {title}
              {titleSuffix && <span className="text-base font-normal text-white/60 md:text-lg">{titleSuffix}</span>}
            </h1>
            {description && <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {metrics.length > 0 && (
          <div className="mt-7 flex gap-0 overflow-x-auto pb-1">
            {metrics.map((metric) => (
              <IntelligenceMetric key={metric.label} {...metric} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
