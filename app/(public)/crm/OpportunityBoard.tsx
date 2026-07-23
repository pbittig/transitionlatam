"use client";

import { useState } from "react";
import { OPPORTUNITY_STAGES, OPPORTUNITY_STAGE_LABEL, type OpportunityStage } from "@/lib/shared/opportunityStages";
import type { OpportunityBoardItem } from "@/lib/data-access/opportunities";
import { Panel } from "../components/Panel";
import { updateOpportunityStage } from "./actions";

function matches(item: OpportunityBoardItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [item.project?.name, item.company?.name, item.person?.name].some((v) => v?.toLowerCase().includes(q));
}

export function OpportunityBoard({ opportunities }: { opportunities: OpportunityBoardItem[] }) {
  const [query, setQuery] = useState("");
  const filtered = opportunities.filter((item) => matches(item, query));

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por proyecto, empresa o contacto..."
        className="w-full max-w-sm rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
      />
      {opportunities.length === 0 && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          El tablero está listo para operar — aún no hay oportunidades creadas. Agrega una desde "Nueva oportunidad" arriba, o desde el botón "Agregar al CRM" en la ficha de cualquier proyecto.
        </p>
      )}
      {opportunities.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Ninguna oportunidad coincide con "{query}".</p>
      )}
      <div className="grid gap-4 xl:grid-cols-4">
        {OPPORTUNITY_STAGES.map((stage) => {
          const items = filtered.filter((item) => item.stage === stage);
          return (
            <Panel key={stage} className="flex min-h-44 flex-col gap-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{OPPORTUNITY_STAGE_LABEL[stage]}</h3>
                <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">{items.length}</span>
              </div>
              {items.map((item) => (
                <article key={item.id} id={`opportunity-${item.id}`} className="border-t border-neutral-100 pt-3 dark:border-neutral-800">
                  <p className="font-medium text-neutral-900 dark:text-neutral-50">{item.project?.name ?? item.company?.name ?? "Oportunidad sin vínculo"}</p>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{item.company?.name ?? item.person?.name ?? item.type ?? "Contexto pendiente"}</p>
                  {item.description && <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{item.description}</p>}
                  {item.nextStep && (
                    <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">
                      Próximo: {item.nextStep}
                      {item.nextStepAt ? ` · ${new Date(item.nextStepAt).toLocaleDateString("es-CL")}` : ""}
                    </p>
                  )}
                  <form action={updateOpportunityStage} className="mt-3">
                    <input type="hidden" name="id" value={item.id} />
                    <select name="stage" defaultValue={item.stage} className="w-full rounded-md border border-neutral-300 bg-transparent px-2 py-1.5 text-xs dark:border-neutral-700">
                      <option value={item.stage}>Mover a…</option>
                      {OPPORTUNITY_STAGES.filter((option) => option !== item.stage).map((option: OpportunityStage) => (
                        <option key={option} value={option}>
                          {OPPORTUNITY_STAGE_LABEL[option]}
                        </option>
                      ))}
                    </select>
                    <button className="mt-1.5 text-xs font-medium text-brand-primary">Actualizar etapa</button>
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
