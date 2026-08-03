"use client";

import { useState } from "react";
import { Building2, CalendarClock, CircleAlert, Search, UserRound } from "lucide-react";
import { OPPORTUNITY_STAGES, OPPORTUNITY_STAGE_LABEL, type OpportunityStage } from "@/lib/shared/opportunityStages";
import type { OpportunityBoardItem } from "@/lib/data-access/opportunities";
import { Panel } from "../components/Panel";
import { updateOpportunityStage } from "./actions";
import type { AppLocale } from "@/lib/i18n";

const OPPORTUNITY_TYPE_LABEL: Record<string, string> = {
  investment: "Inversión",
  epc: "EPC / Construcción",
  technology_sale: "Equipos y tecnología",
  partnership: "Alianza",
  market_entry: "Entrada a mercado",
  development: "Desarrollo",
  advisory: "Servicios profesionales",
};

function matches(item: OpportunityBoardItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [item.project?.name, item.company?.name, item.person?.name, item.ownerName, item.description, item.nextStep, item.type]
    .some((v) => v?.toLowerCase().includes(q));
}

export function OpportunityBoard({ opportunities, locale = "es" }: { opportunities: OpportunityBoardItem[]; locale?: AppLocale }) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const filtered = opportunities.filter((item) =>
    matches(item, query)
    && (typeFilter === "all" || item.type === typeFilter)
    && (!attentionOnly || Boolean(item.nextStepAt && item.nextStepAt < today && !item.stage.startsWith("cierre_"))),
  );
  const availableTypes = Array.from(new Set(opportunities.map((item) => item.type).filter((type): type is string => Boolean(type))));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
        <label className="relative min-w-60 flex-1">
          <span className="sr-only">{locale === "en" ? "Search opportunities" : "Buscar oportunidades"}</span>
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={locale === "en" ? "Project, company, contact or owner..." : "Proyecto, empresa, contacto o responsable..."}
            className="w-full rounded-xl border border-neutral-300 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-brand-primary dark:border-neutral-700 dark:bg-neutral-950"
          />
        </label>
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          aria-label="Filtrar por tipo de oportunidad"
          className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        >
          <option value="all">{locale === "en" ? "All types" : "Todos los tipos"}</option>
          {availableTypes.map((type) => <option key={type} value={type}>{OPPORTUNITY_TYPE_LABEL[type] ?? type}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setAttentionOnly((current) => !current)}
          aria-pressed={attentionOnly}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${
            attentionOnly
              ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
              : "border-neutral-300 bg-white text-neutral-600 hover:border-amber-300 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300"
          }`}
        >
          <CircleAlert size={15} /> {locale === "en" ? "Needs attention" : "Requieren atención"}
        </button>
      </div>
      {opportunities.length === 0 && (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-7 text-center dark:border-neutral-700">
          <p className="font-medium text-neutral-800 dark:text-neutral-100">{locale === "en" ? "Your pipeline is ready" : "Tu pipeline está listo para comenzar"}</p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-neutral-500 dark:text-neutral-400">{locale === "en" ? "Add an opportunity above or select “Add to CRM” from a project. Assign an owner and next action from the start." : "Registra una oportunidad arriba o selecciona “Agregar al CRM” desde un proyecto. Idealmente agrega desde el inicio un responsable y una próxima acción."}</p>
        </div>
      )}
      {opportunities.length > 0 && filtered.length === 0 && (
        <p className="rounded-xl border border-dashed border-neutral-300 p-5 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">{locale === "en" ? "No opportunities match the selected filters." : "No hay oportunidades que coincidan con los filtros seleccionados."}</p>
      )}
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {OPPORTUNITY_STAGES.map((stage) => {
          const items = filtered.filter((item) => item.stage === stage);
          return (
            <Panel key={stage} className="flex min-h-48 flex-col gap-3 bg-neutral-50/70 p-3 dark:bg-neutral-950">
              <div className="flex items-center justify-between gap-2 px-1">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{OPPORTUNITY_STAGE_LABEL[stage]}</h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-neutral-500 shadow-sm dark:bg-neutral-900 dark:text-neutral-400">{items.length}</span>
              </div>
              {items.map((item) => (
                <article key={item.id} id={`opportunity-${item.id}`} className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{item.project?.name ?? item.company?.name ?? "Oportunidad sin vínculo"}</p>
                    {item.nextStepAt && item.nextStepAt < today && !item.stage.startsWith("cierre_") && (
                      <span title="Próxima acción vencida" className="mt-0.5 text-amber-600 dark:text-amber-400"><CircleAlert size={15} /></span>
                    )}
                  </div>
                  {item.type && <span className="mt-2 inline-flex rounded-full bg-brand-surface px-2 py-1 text-[10px] font-semibold text-brand-deep dark:bg-brand-primary/10 dark:text-brand-primary">{OPPORTUNITY_TYPE_LABEL[item.type] ?? item.type}</span>}
                  {item.company?.name && <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400"><Building2 size={12} /> {item.company.name}</p>}
                  {item.person?.name && <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400"><UserRound size={12} /> {item.person.name}</p>}
                  {item.description && <p className="mt-2 line-clamp-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{item.description}</p>}
                  {item.nextStep && (
                    <div className={`mt-3 rounded-lg p-2.5 text-xs ${item.nextStepAt && item.nextStepAt < today ? "bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200" : "bg-neutral-50 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"}`}>
                      <p className="font-medium">{locale === "en" ? "Next:" : "Próximo:"} {item.nextStep}</p>
                      {item.nextStepAt && <p className="mt-1 flex items-center gap-1 opacity-75"><CalendarClock size={12} /> {new Date(`${item.nextStepAt}T12:00:00`).toLocaleDateString("es-CL")}</p>}
                    </div>
                  )}
                  {item.ownerName && <p className="mt-2 text-[11px] text-neutral-400">{locale === "en" ? "Owner:" : "Responsable:"} <span className="font-medium text-neutral-600 dark:text-neutral-300">{item.ownerName}</span></p>}
                  <form action={updateOpportunityStage} className="mt-3">
                    <input type="hidden" name="id" value={item.id} />
                    <select name="stage" defaultValue={item.stage} className="w-full rounded-lg border border-neutral-300 bg-transparent px-2 py-2 text-xs dark:border-neutral-700">
                      <option value={item.stage}>{locale === "en" ? "Change stage…" : "Cambiar etapa…"}</option>
                      {OPPORTUNITY_STAGES.filter((option) => option !== item.stage).map((option: OpportunityStage) => (
                        <option key={option} value={option}>
                          {OPPORTUNITY_STAGE_LABEL[option]}
                        </option>
                      ))}
                    </select>
                    <button className="mt-2 text-xs font-semibold text-brand-deep hover:underline dark:text-brand-primary">{locale === "en" ? "Save change" : "Guardar cambio"}</button>
                  </form>
                </article>
              ))}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
