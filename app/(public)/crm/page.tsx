import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, ChevronDown, Clock3, LockKeyhole, Plus, UsersRound } from "lucide-react";
import { isAdmin } from "@/lib/auth/session";
import { getOpportunityBoard } from "@/lib/data-access/opportunities";
import { OpportunityBoard } from "./OpportunityBoard";
import { Panel } from "../components/Panel";
import { NewOpportunityForm } from "./NewOpportunityForm";

export const metadata: Metadata = { title: "Oportunidades" };
export const dynamic = "force-dynamic";

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
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">Tablero comercial</p>
            <h2 className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-50">Mover solo cuando la realidad comercial cambie</h2>
          </div>
          <Link href="/mapa-stakeholder" className="inline-flex items-center gap-1 text-sm font-medium text-neutral-700 hover:text-brand-primary dark:text-neutral-200">
            Ver relaciones <ArrowUpRight size={15} />
          </Link>
        </div>
        <OpportunityBoard opportunities={opportunities} />
      </section>
    </div>
  );
}
