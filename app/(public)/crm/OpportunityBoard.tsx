"use client";

import { useState } from "react";
import { CalendarDays, Columns3, Search } from "lucide-react";
import { OPPORTUNITY_STAGES, opportunityStageLabel } from "@/lib/shared/opportunityStages";
import type { OpportunityBoardItem, OpportunityProjectOption } from "@/lib/data-access/opportunities";
import { Panel } from "../components/Panel";
import { OpportunityCard } from "./OpportunityCard";
import type { AppLocale } from "@/lib/i18n";

function chileDate(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function matches(item: OpportunityBoardItem, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [item.project?.name, item.company?.name, item.person?.name, item.ownerName, item.description, item.nextStep]
    .some((value) => value?.toLowerCase().includes(normalized));
}

export function OpportunityBoard({ opportunities, projects, locale = "es" }: {
  opportunities: OpportunityBoardItem[];
  projects: OpportunityProjectOption[];
  locale?: AppLocale;
}) {
  const [view, setView] = useState<"today" | "pipeline">("today");
  const [query, setQuery] = useState("");
  const today = chileDate();
  const weekEnd = addDays(today, 7);
  const filtered = opportunities.filter((item) => matches(item, query));
  const contactsFor = (item: OpportunityBoardItem) => projects.find((project) => project.id === item.project?.id)?.contacts ?? [];
  const active = filtered.filter((item) => !item.stage.startsWith("cierre_"));
  const categoryFor = (item: OpportunityBoardItem) => {
    if (!item.nextStep || !item.nextStepAt) return "none";
    if (item.nextStepAt < today) return "overdue";
    if (item.nextStepAt === today) return "today";
    if (item.nextStepAt <= weekEnd) return "week";
    return "later";
  };
  const dayGroups = [
    { key: "overdue", title: locale === "en" ? "Overdue" : "Vencidas", items: active.filter((item) => categoryFor(item) === "overdue"), tone: "border-amber-300 bg-amber-50/50" },
    { key: "today", title: locale === "en" ? "Due today" : "Para hoy", items: active.filter((item) => categoryFor(item) === "today"), tone: "border-brand-primary/40 bg-brand-surface/40" },
    { key: "week", title: locale === "en" ? "Next 7 days" : "Próximos 7 días", items: active.filter((item) => categoryFor(item) === "week"), tone: "border-neutral-200 bg-neutral-50/70" },
    { key: "none", title: locale === "en" ? "No next action" : "Sin próxima acción", items: active.filter((item) => categoryFor(item) === "none"), tone: "border-neutral-200 bg-neutral-50/70" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
        <div className="flex rounded-xl border border-neutral-300 bg-white p-1">
          <button type="button" onClick={() => setView("today")} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${view === "today" ? "bg-neutral-950 text-white" : "text-neutral-600"}`}><CalendarDays size={14} /> {locale === "en" ? "My day" : "Mi día"}</button>
          <button type="button" onClick={() => setView("pipeline")} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${view === "pipeline" ? "bg-neutral-950 text-white" : "text-neutral-600"}`}><Columns3 size={14} /> Pipeline</button>
        </div>
        <label className="relative min-w-60 flex-1">
          <span className="sr-only">{locale === "en" ? "Search opportunities" : "Buscar oportunidades"}</span>
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={locale === "en" ? "Project, company, contact or owner..." : "Proyecto, empresa, contacto o responsable..."} className="w-full rounded-xl border border-neutral-300 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-brand-primary" />
        </label>
      </div>

      {!opportunities.length && <div className="rounded-2xl border border-dashed border-neutral-300 p-7 text-center"><p className="font-medium">{locale === "en" ? "Your pipeline is ready" : "El pipeline está listo para comenzar"}</p><p className="mt-2 text-sm text-neutral-500">{locale === "en" ? "Add an opportunity and assign an owner and next action from the start." : "Registre una oportunidad y defina desde el inicio un responsable y una próxima acción."}</p></div>}

      {view === "today" ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {dayGroups.map((group) => (
            <Panel key={group.key} className={`flex min-h-48 flex-col gap-3 p-3 ${group.tone}`}>
              <div className="flex items-center justify-between px-1"><h3 className="text-sm font-semibold">{group.title}</h3><span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold">{group.items.length}</span></div>
              {group.items.map((item) => <OpportunityCard key={item.id} item={item} contacts={contactsFor(item)} today={today} locale={locale} />)}
              {!group.items.length && <p className="px-1 text-xs text-neutral-400">{locale === "en" ? "No opportunities in this category." : "Sin oportunidades en esta categoría."}</p>}
            </Panel>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {OPPORTUNITY_STAGES.map((stage) => {
            const items = filtered.filter((item) => item.stage === stage);
            return <Panel key={stage} className="flex min-h-48 flex-col gap-3 bg-neutral-50/70 p-3"><div className="flex items-center justify-between px-1"><h3 className="text-sm font-semibold">{opportunityStageLabel(stage, locale)}</h3><span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold">{items.length}</span></div>{items.map((item) => <OpportunityCard key={item.id} item={item} contacts={contactsFor(item)} today={today} locale={locale} />)}</Panel>;
          })}
        </div>
      )}
    </div>
  );
}
