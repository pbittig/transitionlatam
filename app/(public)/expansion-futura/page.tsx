import type { Metadata } from "next";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import {
  aggregatePelp,
  getPelpExpansionForScenario,
  getPelpScenarios,
  techCategoryFor,
  techLabelFor,
} from "@/lib/data-access/pelpExpansion";
import { Panel } from "../components/Panel";
import { BarList } from "../components/BarList";
import { AnnualExpansionChart } from "./AnnualExpansionChart";
import { ModelledDisclaimer } from "./ModelledDisclaimer";
import { getAppLocale } from "@/lib/i18n";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Expansión Futura" };

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
  searchParams: Promise<{ escenario?: string }>;
}) {
  const locale = await getAppLocale();
  const en = locale === "en";
  const { escenario } = await searchParams;
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

  // Por defecto el escenario tendencial (BAU), que es el que muestra la
  // visualización oficial del ministerio.
  const selected =
    scenarios.find((s) => s.scenarioId === escenario) ??
    scenarios.find((s) => s.scenarioId.includes("E2")) ??
    scenarios[0];

  const rows = await getPelpExpansionForScenario(client, selected.scenarioId);
  const agg = aggregatePelp(rows);

  const techs = agg.techCodes.map((code) => ({
    code,
    label: techLabelFor(code, locale),
    category: techCategoryFor(code),
  }));

  const gw = (mw: number) =>
    `${(mw / 1000).toLocaleString(en ? "en-US" : "es-CL", { maximumFractionDigits: 1 })} GW`;
  const mwOf = (code: string) => agg.totalMwByTech.find((t) => t.code === code)?.mw ?? 0;
  const windMw = mwOf("onshore_wind") + mwOf("offshore_wind");

  const bar = (items: Array<{ label: string; mw: number }>, category?: string) =>
    items.map((i) => ({ label: i.label, value: i.mw, secondaryValue: gw(i.mw), techCategory: category }));

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
        <p className="mt-2 max-w-3xl text-sm text-neutral-600 dark:text-neutral-400">
          {en
            ? "Long-term energy planning (PELP) of Chile's Ministry of Energy — SEN expansion model (PyPSA-CL)."
            : "Planificación Energética de Largo Plazo (PELP) del Ministerio de Energía — modelo de expansión del SEN (PyPSA-CL)."}
        </p>
      </div>

      <ModelledDisclaimer locale={locale} />

      {/* Selector de escenario. Los escenarios son futuros alternativos: la página
          muestra uno a la vez a propósito, nunca la suma. */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {en ? "Scenario" : "Escenario"}
        </p>
        <div className="flex flex-wrap gap-2">
          {scenarios.map((s) => (
            <Link
              key={s.scenarioId}
              href={`/expansion-futura?escenario=${encodeURIComponent(s.scenarioId)}`}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                s.scenarioId === selected.scenarioId
                  ? "border-brand-primary bg-brand-surface text-brand-deep dark:border-brand-primary dark:bg-brand-primary/10 dark:text-brand-primary"
                  : "border-neutral-200 text-neutral-600 hover:border-neutral-300 dark:border-neutral-800 dark:text-neutral-400"
              }`}
            >
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
          hint={`${agg.nodeCount} ${en ? "nodes" : "nodos"} · ${agg.comunaCount} ${en ? "comunas" : "comunas"} · ${agg.years[0]}–${agg.years[agg.years.length - 1]}`}
        />
      </div>

      <Panel>
        <h2 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          {en ? "Annual expansion by technology" : "Expansión anual por tecnología"}
        </h2>
        <AnnualExpansionChart data={agg.mwByYearAndTech} techs={techs} locale={locale} />
      </Panel>

      <Panel>
        <h2 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          {en ? "Cumulative expansion by technology" : "Expansión acumulada por tecnología"}
        </h2>
        <AnnualExpansionChart data={agg.cumulativeByYearAndTech} techs={techs} locale={locale} cumulative />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            {en ? "Expansion by region" : "Expansión por región"}
          </h2>
          <BarList items={bar(agg.mwByRegion)} categorical />
        </Panel>
        <Panel>
          <h2 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            {en ? "Expansion by comuna" : "Expansión por comuna"}
          </h2>
          <BarList items={bar(agg.mwByComuna)} categorical />
        </Panel>
        <Panel>
          <h2 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            {en ? "Solar by region" : "Solar por región"}
          </h2>
          <BarList items={bar(agg.solarByRegion, "Solar")} />
        </Panel>
        <Panel>
          <h2 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            {en ? "Wind by region" : "Eólico por región"}
          </h2>
          <BarList items={bar(agg.windByRegion, "Eólico")} />
        </Panel>
        <Panel className="lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            {en ? "BESS by node" : "BESS por nodo"}
          </h2>
          <BarList items={bar(agg.bessByNode, "BESS")} />
        </Panel>
      </div>
    </div>
  );
}
