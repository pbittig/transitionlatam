import { Building2, CornerDownRight, Info } from "lucide-react";
import { techColor, lightDark, PRINCIPAL_COLOR } from "@/lib/shared/chartColors";
import type { MarketTechCategory } from "@/lib/shared/marketTechCategories";
import { Panel } from "../components/Panel";

/**
 * Cómo se verá la relación societaria — con nombres inventados, a propósito.
 *
 * Por qué es un ejemplo y no datos reales: el sistema no tiene hoy ninguna
 * fuente de propiedad. `company_shareholding` está vacía (cero participaciones
 * accionarias). La tabla `spv` parece una relación matriz→filial pero no lo es:
 * de sus 1.616 filas con matriz declarada, 1.509 llevan EXACTAMENTE el mismo
 * nombre que su matriz, 81 son variantes con erratas, y de las 26 restantes la
 * mayoría son cambios de marca de la misma empresa (Solarpack→Zelestra, AES
 * Gener→AES Andes, Trinergy→Trivento) o relaciones invertidas, donde la
 * "filial" es la empresa grande. Dibujar eso como estructura de propiedad
 * mostraría a Zelestra como filial de Solarpack, que es la misma sociedad
 * después de cambiarse el nombre.
 *
 * Por eso acá va la forma de la sección, rotulada como ejemplo, y ninguna
 * afirmación sobre quién es dueño de quién. Cuando se integre la API de
 * sociedades, este componente se llena con los datos reales y el rótulo se cae.
 */

interface NodoEjemplo {
  nombre: string;
  categoria: MarketTechCategory;
  participacion: string;
  totalMw: number;
  proyecto: string;
}

const EJEMPLO: NodoEjemplo[] = [
  { nombre: "Horizonte Solar Uno SpA", categoria: "Solar", participacion: "100%", totalMw: 180, proyecto: "PFV Horizonte Uno · 180 MW" },
  { nombre: "Almacenamiento Atacama SpA", categoria: "BESS", participacion: "70%", totalMw: 120, proyecto: "BESS Atacama · 120 MW / 480 MWh" },
  { nombre: "Vientos del Sur SpA", categoria: "Eólico", participacion: "51%", totalMw: 96, proyecto: "Parque Eólico Vientos del Sur · 96 MW" },
  { nombre: "Hidro Maule Dos SpA", categoria: "Hidro", participacion: "100%", totalMw: 42, proyecto: "Central Maule Dos · 42 MW" },
];

function NodoMatriz() {
  return (
    <div
      className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl px-5 py-4 text-center shadow-lg"
      style={{
        background: `linear-gradient(135deg, ${lightDark(PRINCIPAL_COLOR)} 0%, color-mix(in srgb, ${lightDark(PRINCIPAL_COLOR)} 55%, #0f766e) 100%)`,
      }}
    >
      <span className="absolute -top-8 -right-6 h-24 w-24 rounded-full bg-white/15" aria-hidden />
      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white uppercase">
          <Building2 size={12} /> Matriz
        </span>
        <p className="mt-2 text-base leading-tight font-semibold text-white">Grupo Energético Cordillera SpA</p>
        <p className="mt-1 text-xs tabular-nums text-white/80">RUT ficticio 99.999.991-3</p>
      </div>
    </div>
  );
}

function TarjetaSpv({ nodo }: { nodo: NodoEjemplo }) {
  const color = lightDark(techColor(nodo.categoria));
  return (
    <div className="flex flex-col">
      <span aria-hidden className="mx-auto h-4 w-px bg-neutral-300 dark:bg-neutral-700" />
      <div
        className="flex flex-1 flex-col gap-2 rounded-xl border-l-4 p-3.5 shadow-sm"
        style={{ borderLeftColor: color, background: `color-mix(in srgb, ${color} 8%, transparent)` }}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[10px] font-semibold tracking-wide uppercase" style={{ color }}>
            {nodo.categoria}
          </span>
          <span
            className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
            style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
          >
            {nodo.participacion}
          </span>
        </div>
        <div>
          <p className="text-sm leading-snug font-semibold text-neutral-900 dark:text-neutral-50">{nodo.nombre}</p>
          <p className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
            {nodo.totalMw.toLocaleString("es-CL")} MW
          </p>
        </div>
        <p className="flex items-start gap-1.5 border-t border-neutral-200/70 pt-2 text-xs leading-snug text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
          <CornerDownRight size={12} className="mt-0.5 shrink-0 opacity-60" />
          {nodo.proyecto}
        </p>
      </div>
    </div>
  );
}

export function OwnershipChainDiagram({ companyName }: { companyName: string }) {
  return (
    <Panel className="flex flex-col gap-5 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Relación societaria</h2>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
            La matriz, su participación en cada sociedad vehículo y el proyecto que cuelga de cada una.
          </p>
        </div>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {EJEMPLO.map((n) => (
            <li key={n.categoria} className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: lightDark(techColor(n.categoria)) }} aria-hidden />
              {n.categoria}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-dashed border-amber-300 p-4 dark:border-amber-900/60">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold tracking-wide text-amber-900 uppercase dark:bg-amber-950 dark:text-amber-200">
            Ejemplo ficticio
          </span>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Nombres, RUT y porcentajes inventados. No son datos de {companyName}.
          </p>
        </div>

        <NodoMatriz />
        <div aria-hidden className="flex flex-col items-center">
          <span className="h-5 w-px bg-neutral-300 dark:bg-neutral-700" />
          <span className="h-px w-4/5 bg-neutral-300 dark:bg-neutral-700" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {EJEMPLO.map((n) => (
            <TarjetaSpv key={n.nombre} nodo={n} />
          ))}
        </div>
      </div>

      <p className="flex items-start gap-2 border-t border-neutral-200 pt-3 text-xs leading-5 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          Todavía no hay ninguna participación accionaria registrada, así que no se afirma quién es dueño de quién. Las
          sociedades que sí constan hoy para cada empresa aparecen más abajo, tal como las declara la fuente. Esta vista
          se llenará con datos reales al integrar la API de sociedades.
        </span>
      </p>
    </Panel>
  );
}
