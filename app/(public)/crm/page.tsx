import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, ChevronDown, CircleCheckBig, Clock3, LockKeyhole, Plus, UsersRound } from "lucide-react";
import { isAdmin } from "@/lib/auth/session";
import { OPPORTUNITY_STAGE_LABEL, type OpportunityStage, getOpportunityBoard } from "@/lib/data-access/opportunities";
import { Panel } from "../components/Panel";
import { updateOpportunityStage } from "./actions";
import { NewOpportunityForm } from "./NewOpportunityForm";

export const metadata: Metadata = { title: "Oportunidades" };
export const dynamic = "force-dynamic";

const BOARD_STAGES: OpportunityStage[] = ["contacto", "reunion", "elaboracion_propuesta", "envio_propuesta", "seguimiento"];

export default async function CrmPage() {
  const admin = await isAdmin();
  if (!admin) {
    return (
      <div className="flex max-w-2xl flex-col gap-6 py-10">
        <LockKeyhole size={28} className="text-brand-primary" />
        <div>
          <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">Espacio interno</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Gestión de oportunidades</h1>
          <p className="mt-3 text-neutral-600 dark:text-neutral-400">El seguimiento comercial —contactos, conversaciones y propuestas— está disponible solo para el equipo de ONIX.</p>
        </div>
        <Link href="/login" className="inline-flex w-fit items-center gap-1 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-neutral-50 dark:text-neutral-900">Ingresar <ArrowUpRight size={16} /></Link>
      </div>
    );
  }

  const opportunities = await getOpportunityBoard((await import("@/lib/data-access/supabase-service-client")).createSupabaseServiceClient());
  const contactReady = opportunities.filter((item) => item.stage === "contacto").length;
  const inConversation = opportunities.filter((item) => item.stage === "reunion").length;
  const withNextStep = opportunities.filter((item) => item.nextStepAt).length;

  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-wrap items-end justify-between gap-5 border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400"><BriefcaseBusiness size={14} className="text-brand-primary" /> CRM interno</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl dark:text-neutral-50">Oportunidades de transición</h1>
          <p className="mt-2 max-w-2xl text-neutral-600 dark:text-neutral-400">Convierte señales de mercado en conversaciones comerciales trazables: empresa, proyecto, contacto, próxima acción y resultado.</p>
        </div>
      </section>

      <details className="group rounded-lg border border-neutral-200 dark:border-neutral-800">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 py-3 text-sm font-medium text-neutral-700 select-none [&::-webkit-details-marker]:hidden dark:text-neutral-300">
          <Plus size={16} /> Nueva oportunidad
          <ChevronDown size={14} className="ml-auto text-neutral-400 transition-transform group-open:rotate-180 dark:text-neutral-500" />
        </summary>
        <div className="border-t border-neutral-100 px-4 py-4 dark:border-neutral-900">
          <NewOpportunityForm />
        </div>
      </details>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumen de oportunidades">
        <Panel className="p-4"><div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400"><UsersRound size={15} /> Por contactar</div><p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">{contactReady}</p><p className="text-sm text-neutral-500 dark:text-neutral-400">oportunidades listas para abrir conversación</p></Panel>
        <Panel className="p-4"><div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400"><BriefcaseBusiness size={15} /> En conversación</div><p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">{inConversation}</p><p className="text-sm text-neutral-500 dark:text-neutral-400">con un contacto o empresa activa</p></Panel>
        <Panel className="p-4"><div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400"><Clock3 size={15} /> Siguiente acción</div><p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">{withNextStep}</p><p className="text-sm text-neutral-500 dark:text-neutral-400">oportunidades con seguimiento programado</p></Panel>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">Tablero comercial</p><h2 className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-50">Mover solo cuando la realidad comercial cambie</h2></div><Link href="/mapa-stakeholder" className="inline-flex items-center gap-1 text-sm font-medium text-neutral-700 hover:text-brand-primary dark:text-neutral-200">Ver relaciones <ArrowUpRight size={15} /></Link></div>
        {opportunities.length === 0 ? (
          <Panel className="flex flex-col items-start gap-3 border-dashed"><CircleCheckBig size={20} className="text-brand-primary" /><div><h3 className="font-medium text-neutral-900 dark:text-neutral-50">El tablero está listo para operar</h3><p className="mt-1 max-w-xl text-sm text-neutral-500 dark:text-neutral-400">Aún no hay oportunidades creadas. Al habilitar la carga, cada señal podrá enlazarse con el proyecto, la empresa, el contacto y la próxima acción.</p></div></Panel>
        ) : (
          <div className="grid gap-4 xl:grid-cols-3">
            {BOARD_STAGES.map((stage) => {
              const items = opportunities.filter((item) => item.stage === stage);
              return <Panel key={stage} className="flex min-h-44 flex-col gap-3 p-4"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{OPPORTUNITY_STAGE_LABEL[stage]}</h3><span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">{items.length}</span></div>{items.map((item) => <article key={item.id} className="border-t border-neutral-100 pt-3 dark:border-neutral-800"><p className="font-medium text-neutral-900 dark:text-neutral-50">{item.project?.name ?? item.company?.name ?? "Oportunidad sin vínculo"}</p><p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{item.company?.name ?? item.person?.name ?? item.type ?? "Contexto pendiente"}</p>{item.description && <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{item.description}</p>}{item.nextStep && <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">Próximo: {item.nextStep}{item.nextStepAt ? ` · ${new Date(item.nextStepAt).toLocaleDateString("es-CL")}` : ""}</p>}<form action={updateOpportunityStage} className="mt-3"><input type="hidden" name="id" value={item.id} /><select name="stage" defaultValue={item.stage} className="w-full rounded-md border border-neutral-300 bg-transparent px-2 py-1.5 text-xs dark:border-neutral-700"><option value={item.stage}>Mover a…</option>{BOARD_STAGES.filter((option) => option !== item.stage).map((option) => <option key={option} value={option}>{OPPORTUNITY_STAGE_LABEL[option]}</option>)}</select><button className="mt-1.5 text-xs font-medium text-brand-primary">Actualizar etapa</button></form></article>)}</Panel>;
            })}
          </div>
        )}
      </section>
    </div>
  );
}
