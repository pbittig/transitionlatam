"use client";

import { Building2, CalendarClock, CircleAlert, History, Pencil, UserRound } from "lucide-react";
import type { OpportunityBoardItem, OpportunityProjectOption } from "@/lib/data-access/opportunities";
import { OPPORTUNITY_STAGES, OPPORTUNITY_STAGE_LABEL } from "@/lib/shared/opportunityStages";
import { addOpportunityActivity, updateOpportunity } from "./actions";
import type { AppLocale } from "@/lib/i18n";

const ACTIVITY_LABELS = { note: "Nota", call: "Llamada", meeting: "Reunión", email: "Correo", stage_change: "Cambio de etapa" } as const;

export function OpportunityCard({ item, contacts, today, locale }: {
  item: OpportunityBoardItem;
  contacts: OpportunityProjectOption["contacts"];
  today: string;
  locale: AppLocale;
}) {
  const overdue = Boolean(item.nextStepAt && item.nextStepAt < today && !item.stage.startsWith("cierre_"));
  return (
    <article id={`opportunity-${item.id}`} className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{item.project?.name ?? item.company?.name ?? "Oportunidad sin vínculo"}</p>
        {overdue && <span title="Próxima acción vencida" className="mt-0.5 text-amber-600"><CircleAlert size={15} /></span>}
      </div>
      {item.company?.name && <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500"><Building2 size={12} /> {item.company.name}</p>}
      {item.person?.name && <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500"><UserRound size={12} /> {item.person.name}</p>}
      {item.description && <p className="mt-2 line-clamp-3 text-xs leading-5 text-neutral-500">{item.description}</p>}
      {item.nextStep && (
        <div className={`mt-3 rounded-lg p-2.5 text-xs ${overdue ? "bg-amber-50 text-amber-900" : "bg-neutral-50 text-neutral-700"}`}>
          <p className="font-medium">{locale === "en" ? "Next:" : "Próximo:"} {item.nextStep}</p>
          {item.nextStepAt && <p className="mt-1 flex items-center gap-1 opacity-75"><CalendarClock size={12} /> {new Date(`${item.nextStepAt}T12:00:00`).toLocaleDateString("es-CL")}</p>}
        </div>
      )}
      {item.ownerName && <p className="mt-2 text-[11px] text-neutral-400">Responsable: <span className="font-medium text-neutral-600">{item.ownerName}</span></p>}

      <details className="group mt-3 border-t border-neutral-100 pt-3">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-brand-deep"><Pencil size={13} /> Editar oportunidad</summary>
        <form action={updateOpportunity} className="mt-3 grid gap-2">
          <input type="hidden" name="id" value={item.id} />
          <select name="stage" defaultValue={item.stage} className="rounded-lg border border-neutral-300 bg-white px-2 py-2 text-xs">
            {OPPORTUNITY_STAGES.map((stage) => <option key={stage} value={stage}>{OPPORTUNITY_STAGE_LABEL[stage]}</option>)}
          </select>
          <textarea name="description" defaultValue={item.description ?? ""} required rows={3} aria-label="Contexto comercial" className="rounded-lg border border-neutral-300 px-2 py-2 text-xs" />
          <input name="ownerName" defaultValue={item.ownerName ?? ""} placeholder="Responsable" className="rounded-lg border border-neutral-300 px-2 py-2 text-xs" />
          <select name="personId" defaultValue={item.person?.id ?? ""} className="rounded-lg border border-neutral-300 bg-white px-2 py-2 text-xs">
            <option value="">Sin contacto</option>
            {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}{contact.email ? ` (${contact.email})` : ""}</option>)}
          </select>
          <input name="nextStep" defaultValue={item.nextStep ?? ""} placeholder="Próxima acción" className="rounded-lg border border-neutral-300 px-2 py-2 text-xs" />
          <input name="nextStepAt" type="date" defaultValue={item.nextStepAt ?? ""} aria-label="Fecha compromiso" className="rounded-lg border border-neutral-300 px-2 py-2 text-xs" />
          <button className="rounded-lg bg-brand-primary px-3 py-2 text-xs font-semibold text-neutral-950">Guardar cambios</button>
        </form>
      </details>

      <details className="group mt-3 border-t border-neutral-100 pt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-neutral-700">
          <span className="flex items-center gap-1.5"><History size={13} /> Historial</span>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px]">{item.activities.length}</span>
        </summary>
        <form action={addOpportunityActivity} className="mt-3 grid gap-2">
          <input type="hidden" name="opportunityId" value={item.id} />
          <div className="grid grid-cols-2 gap-2">
            <select name="activityType" defaultValue="note" className="rounded-lg border border-neutral-300 bg-white px-2 py-2 text-xs">
              <option value="note">Nota</option><option value="call">Llamada</option><option value="meeting">Reunión</option><option value="email">Correo</option>
            </select>
            <input name="occurredAt" type="date" defaultValue={today} aria-label="Fecha de actividad" className="rounded-lg border border-neutral-300 px-2 py-2 text-xs" />
          </div>
          <textarea name="note" required rows={2} placeholder="¿Qué ocurrió?" className="rounded-lg border border-neutral-300 px-2 py-2 text-xs" />
          <button className="rounded-lg border border-brand-primary px-3 py-2 text-xs font-semibold text-brand-deep">Registrar actividad</button>
        </form>
        <ol className="mt-3 space-y-2 border-l border-neutral-200 pl-3">
          {item.activities.map((activity) => (
            <li key={activity.id} className="text-[11px] leading-4 text-neutral-500">
              <p><span className="font-semibold text-neutral-700">{ACTIVITY_LABELS[activity.type]}</span> · {new Date(activity.occurredAt).toLocaleDateString("es-CL")}</p>
              <p>{activity.note}</p>
              {activity.authorName && <p className="text-neutral-400">{activity.authorName}</p>}
            </li>
          ))}
          {!item.activities.length && <li className="text-[11px] text-neutral-400">Aún no hay actividades registradas.</li>}
        </ol>
      </details>
    </article>
  );
}
