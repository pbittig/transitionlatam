import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import {
  OFFSHORE_WIND_TINT,
  aggregatePelp,
  getPelpExpansionForScenario,
  getPelpScenarios,
  techCategoryFor,
  techLabelFor,
} from "@/lib/data-access/pelpExpansion";
import { Panel } from "../components/Panel";
import { AnnualExpansionChart } from "./AnnualExpansionChart";
import { ModelledDisclaimer } from "./ModelledDisclaimer";
import { getAppLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Expansión Futura" };

/** Tope de filas renderizadas: son ~3.100 por escenario y el navegador no necesita todas de una. */
const TABLE_LIMIT = 250;

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Panel className="p-5">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-neutral-400">{hint}</p>}
    </Panel>
  );
}

export default async function ExpansionFuturaPage({
  searchParams,
}: {
  searchParams: Promise<{ escenario?: string; desde?: string; hasta?: string; tec?: string; region?: string }>;
}) {
  const locale = await getAppLocale();
  const en = locale === "en";
  const sp = await searchParams;
  const client = createSupabaseServiceClient();

  const scenarios = await getPelpScenarios(client);
  if (!scenarios.length) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          {en ? "Future Expansion" : "Expansión Futura"}
        </h1>
        <Panel>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {en ? "No PELP data loaded yet." : "Todavía no hay datos de PELP cargados."}
          </p>
        </Panel>
      </div>
    );
  }

  const selected =
    scenarios.find((s) => s.scenarioId === sp.escenario) ??
    scenarios.find((s) => s.scenarioId.includes("E2")) ??
    scenarios[0];

  const allRows = await getPelpExpansionForScenario(client, selected.scenarioId);
  const allYears = [...new Set(allRows.map((r) => r.year))].sort((a, b) => a - b);
  const minYear = allYears[0];
  const maxYear = allYears[allYears.length - 1];
  const desde = Number(sp.desde) || minYear;
  const hasta = Number(sp.hasta) || maxYear;

  const rows = allRows.filter((r) => r.year >= desde && r.year <= hasta);
  const agg = aggregatePelp(rows);

  const techs = agg.techCodes.map((code) => ({
    code,
    label: techLabelFor(code, locale),
    category: techCategoryFor(code),
    color: code === "offshore_wind" ? OFFSHORE_WIND_TINT.light : undefined,
  }));

  // Sin decimales, como pidió el usuario. En MW y no GW porque una expansión de
  // 0,02 GW redondeada a GW quedaría en "0" y la fila no diría nada.
  const mw = (v: number) => Math.round(v).toLocaleString(en ? "en-US" : "es-CL");
  const gw = (v: number) => `${Math.round(v / 1000).toLocaleString(en ? "en-US" : "es-CL")} GW`;
  const mwOf = (code: string) => agg.totalMwByTech.find((t) => t.code === code)?.mw ?? 0;
  const windMw = mwOf("onshore_wind") + mwOf("offshore_wind");

  const regions = [...new Set(allRows.map((r) => r.regionRaw).filter(Boolean))].sort() as string[];

  const tableRows = rows
    .filter((r) => (!sp.tec || r.technologyCode === sp.tec) && (!sp.region || r.regionRaw === sp.region))
    .sort((a, b) => a.year - b.year || a.assetNameRaw.localeCompare(b.assetNameRaw));

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const base = { escenario: selected.scenarioId, desde: String(desde), hasta: String(hasta), tec: sp.tec, region: sp.region, ...patch };
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    return `/expansion-futura?${p.toString()}`;
  };

  const chip = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
      active
        ? "border-brand-primary bg-brand-surface text-brand-deep dark:border-brand-primary dark:bg-brand-primary/10 dark:text-brand-primary"
        : "border-neutral-200 text-neutral-600 hover:border-neutral-300 dark:border-neutral-800 dark:text-neutral-400"
    }`;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            {en ? "Future Expansion" : "Expansión Futura"}
          </h1>
          <span className="rounded-md bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-400">
            {en ? "PELP — MODELLED EXPANSION" : "PELP — EXPANSIÓN MODELADA"}
          </span>
        </div>
      </div>

      <ModelledDisclaimer locale={locale} />

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{en ? "Scenario" : "Escenario"}</p>
        <div className="flex flex-wrap gap-2">
          {scenarios.map((s) => (
            <Link key={s.scenarioId} href={qs({ escenario: s.scenarioId })} className={chip(s.scenarioId === selected.scenarioId)}>
              {s.scenarioName}
            </Link>
          ))}
        </div>
        <p className="text-[11px] text-neutral-400">
          {en
            ? "Scenarios are alternative futures, not parts of a total — they are never summed."
            : "Los escenarios son futuros alternativos, no partes de un total — nunca se suman entre sí."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={en ? "Solar PV" : "Solar fotovoltaica"} value={gw(mwOf("solar_PV"))} />
        <StatTile label={en ? "Wind (on + offshore)" : "Eólica (on + offshore)"} value={gw(windMw)} />
        <StatTile label={en ? "BESS storage" : "Almacenamiento BESS"} value={gw(mwOf("BESS"))} />
        <StatTile
          label={en ? "Modelled assets" : "Activos modelados"}
          value={agg.assetCount.toLocaleString(en ? "en-US" : "es-CL")}
          hint={`${agg.nodeCount} ${en ? "nodes" : "nodos"} · ${agg.comunaCount} comunas`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr_1fr]">
        {/* Panel de contexto del modelo, equivalente al de la visualización oficial. */}
        <Panel className="flex flex-col gap-3 p-5">
          <div>
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {en ? "Data period" : "Período de datos"}
            </p>
            <p className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              {desde} – {hasta}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[minYear, 2030, 2035, 2040, 2045, 2050].filter((y) => y >= minYear && y <= maxYear).map((y) => (
              <Link key={y} href={qs({ desde: String(y), hasta: String(maxYear) })} className={chip(y === desde)}>
                {y}+
              </Link>
            ))}
            {desde !== minYear && (
              <Link href={qs({ desde: String(minYear), hasta: String(maxYear) })} className={chip(false)}>
                {en ? "All" : "Todo"}
              </Link>
            )}
          </div>
          <p className="border-t border-neutral-100 pt-3 text-[11px] leading-5 text-neutral-500 dark:border-neutral-900 dark:text-neutral-400">
            {en
              ? "The SEN expansion model determines how transmission, generation and storage capacity should expand, through a co-optimisation that minimises the system's investment and operation costs."
              : "El modelo de expansión del SEN determina cómo debiera expandirse la capacidad futura de la infraestructura de transmisión, generación y almacenamiento mediante una co-optimización que minimiza los costos de inversión y operación del SEN."}
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            {en ? "Expansion trajectory" : "Trayectoria de expansión"}
          </h2>
          <AnnualExpansionChart data={agg.mwByYearAndTech} techs={techs} locale={locale} />
        </Panel>

        <Panel>
          <h2 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            {en ? "Cumulative expansion trajectory" : "Trayectoria acumulada de expansión"}
          </h2>
          <AnnualExpansionChart data={agg.cumulativeByYearAndTech} techs={techs} locale={locale} cumulative />
        </Panel>
      </div>

      <Panel className="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 p-4 dark:border-neutral-900">
          <Link href={qs({ tec: undefined })} className={chip(!sp.tec)}>
            {en ? "All technologies" : "Todas las tecnologías"}
          </Link>
          {agg.techCodes.map((code) => (
            <Link key={code} href={qs({ tec: code })} className={chip(sp.tec === code)}>
              {techLabelFor(code, locale)}
            </Link>
          ))}
          <select
            defaultValue={sp.region ?? ""}
            className="ml-auto rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400"
            disabled
            aria-label={en ? "Region" : "Región"}
          >
            <option value="">{en ? `${regions.length} regions` : `${regions.length} regiones`}</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3 font-medium">{en ? "Asset" : "Activo"}</th>
                <th className="px-4 py-3 font-medium">{en ? "Node" : "Nodo"}</th>
                <th className="px-4 py-3 font-medium">{en ? "Year" : "Año"}</th>
                <th className="px-4 py-3 text-right font-medium">{en ? "Expansion [MW]" : "Expansión [MW]"}</th>
                <th className="px-4 py-3 text-right font-medium">
                  {en ? "Cumulative [MW]" : "Expansión acumulada [MW]"}
                </th>
                <th className="px-4 py-3 font-medium">{en ? "Region" : "Región"}</th>
                <th className="px-4 py-3 font-medium">Comuna</th>
                <th className="px-4 py-3 font-medium">{en ? "Status" : "Estado"}</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.slice(0, TABLE_LIMIT).map((r) => (
                <tr
                  key={`${r.assetNameRaw}-${r.nodeRaw}-${r.year}`}
                  className="border-b border-neutral-50 last:border-0 dark:border-neutral-900/60"
                >
                  <td className="px-4 py-2.5 font-medium text-neutral-900 dark:text-neutral-100">{r.assetNameRaw}</td>
                  <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">{r.nodeRaw}</td>
                  <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">{r.year}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-neutral-900 dark:text-neutral-100">{mw(r.capacityMw)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                    {mw(r.capacityCumulativeMw)}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">{r.regionRaw ?? "—"}</td>
                  <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">{r.comunaRaw ?? "—"}</td>
                  {/* La etiqueta va en CADA fila a propósito: es lo que impide leer
                      "solar PV_Antofagasta_39" como un proyecto real de esa comuna. */}
                  <td className="px-4 py-2.5">
                    <span className="whitespace-nowrap rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-400">
                      {en ? "PELP MODELLED" : "MODELADO PELP"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="border-t border-neutral-100 px-4 py-3 text-[11px] text-neutral-400 dark:border-neutral-900">
          {en
            ? `Showing ${Math.min(tableRows.length, TABLE_LIMIT).toLocaleString("en-US")} of ${tableRows.length.toLocaleString("en-US")} modelled records`
            : `Mostrando ${Math.min(tableRows.length, TABLE_LIMIT).toLocaleString("es-CL")} de ${tableRows.length.toLocaleString("es-CL")} registros modelados`}
        </p>
      </Panel>

      <p className="text-center text-[11px] text-neutral-400">
        {selected.scenarioName} ·{" "}
        <a
          href="https://energia.gob.cl/pelp/proyecciones-electricas"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-neutral-600 dark:hover:text-neutral-300"
        >
          Informe Preliminar PELP 2028-2032 — Ministerio de Energía
        </a>
      </p>
    </div>
  );
}
