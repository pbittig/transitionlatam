import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Factory,
  Handshake,
  LockKeyhole,
  Plus,
  Target,
  Wrench,
  Zap,
} from "lucide-react";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";
import { getOpportunityBoard, getOpportunityProjectOptions } from "@/lib/data-access/opportunities";
import { OpportunityBoard } from "./OpportunityBoard";
import { Panel } from "../components/Panel";
import { NewOpportunityForm } from "./NewOpportunityForm";
import { PlanGate } from "../components/PlanGate";

export const metadata: Metadata = { title: "Oportunidades" };
export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const admin = await isAdmin();
  const client = await createSupabaseServerClient();
  const profile = admin ? null : await getCurrentUserProfile(client);

  // Sin sesión ninguna: no hay plan que consultar, se pide iniciar sesión —
  // distinto de "sesión con plan Free", que si ve la página (bloqueada, ver
  // PlanGate más abajo) en vez de esta pantalla de acceso.
  if (!admin && !profile) {
    return (
      <div className="flex max-w-2xl flex-col gap-6 py-10">
        <LockKeyhole size={28} className="text-brand-primary" />
        <div>
          <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">Espacio interno</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Gestión de oportunidades</h1>
          <p className="mt-3 text-neutral-600 dark:text-neutral-400">Inicia sesión para acceder al seguimiento comercial — contactos, conversaciones y propuestas.</p>
        </div>
        <Link href="/login" className="inline-flex w-fit items-center gap-1 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-neutral-50 dark:text-neutral-900">Ingresar <ArrowUpRight size={16} /></Link>
      </div>
    );
  }

  const premiumLocked = !admin && profile?.planCode !== "premium";
  const serviceClient = (await import("@/lib/data-access/supabase-service-client")).createSupabaseServiceClient();
  const [opportunities, projectOptions] = await Promise.all([
    getOpportunityBoard(serviceClient),
    getOpportunityProjectOptions(serviceClient),
  ]);
  const contactReady = opportunities.filter((item) => item.stage === "contacto").length;
  const inConversation = opportunities.filter((item) => item.stage === "reunion").length;
  const withNextStep = opportunities.filter((item) => item.nextStepAt).length;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = opportunities.filter((item) => item.nextStepAt && item.nextStepAt < today && !item.stage.startsWith("cierre_")).length;
  const active = opportunities.filter((item) => !item.stage.startsWith("cierre_")).length;
  const won = opportunities.filter((item) => item.stage === "cierre_ganado").length;

  return (
    <div className="flex flex-col gap-7">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-ink via-brand-deep to-[#1b8d83] px-6 py-9 text-white shadow-xl shadow-brand-deep/10 md:px-8 md:py-11">
        <span className="absolute -top-24 right-4 h-64 w-64 rounded-full border border-white/10" aria-hidden />
        <span className="absolute -right-10 -bottom-24 h-64 w-64 rounded-full bg-brand-primary/20 blur-2xl" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-brand-primary uppercase"><Target size={14} /> Inteligencia comercial aplicada</div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">Oportunidades</h1>
            <p className="mt-3 text-sm leading-6 text-white/75 md:text-base">
              Convierte un proyecto detectado en una oportunidad accionable: entiende el contexto, identifica la empresa y el contacto correcto, define un responsable y nunca pierdas el próximo paso.
            </p>
          </div>
          <Link href="/proyectos-esperados" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-ink shadow-sm transition hover:-translate-y-0.5">
            Buscar proyectos <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>

      <section aria-labelledby="crm-role-title">
        <p className="text-xs font-semibold tracking-wide text-brand-deep uppercase dark:text-brand-primary">Un mismo mercado, distintas oportunidades</p>
        <h2 id="crm-role-title" className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">Úsalo según tu rol en el ecosistema</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { icon: Zap, role: "IPP / Developer", value: "Socios, terrenos, conexión y cartera competidora" },
            { icon: BadgeDollarSign, role: "Inversionista", value: "Activos, contrapartes y oportunidades de capital" },
            { icon: Wrench, role: "EPC / Contratista", value: "Proyectos próximos a ingeniería y construcción" },
            { icon: Factory, role: "Vendor", value: "Demanda potencial de equipos y tecnología" },
            { icon: Handshake, role: "Asesor / Servicios", value: "Permisos, estudios, estructuración y apoyo experto" },
          ].map(({ icon: Icon, role, value }) => (
            <article key={role} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-surface text-brand-deep dark:bg-brand-primary/10 dark:text-brand-primary"><Icon size={17} /></span>
              <h3 className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{role}</h3>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen de oportunidades">
        <Panel className="border-t-2 border-t-brand-primary p-4"><div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400"><BriefcaseBusiness size={15} /> Pipeline activo</div><p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50"><PlanGate locked={premiumLocked} label="Plan Premium">{active}</PlanGate></p><p className="text-sm text-neutral-500 dark:text-neutral-400">{contactReady} por contactar · {inConversation} en reunión</p></Panel>
        <Panel className="border-t-2 border-t-amber-400 p-4"><div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400"><CircleAlert size={15} /> Requieren atención</div><p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50"><PlanGate locked={premiumLocked} label="Plan Premium">{overdue}</PlanGate></p><p className="text-sm text-neutral-500 dark:text-neutral-400">acciones vencidas que conviene resolver</p></Panel>
        <Panel className="border-t-2 border-t-blue-400 p-4"><div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400"><Clock3 size={15} /> Con próxima acción</div><p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50"><PlanGate locked={premiumLocked} label="Plan Premium">{withNextStep}</PlanGate></p><p className="text-sm text-neutral-500 dark:text-neutral-400">oportunidades con seguimiento programado</p></Panel>
        <Panel className="border-t-2 border-t-emerald-500 p-4"><div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400"><Handshake size={15} /> Ganadas</div><p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50"><PlanGate locked={premiumLocked} label="Plan Premium">{won}</PlanGate></p><p className="text-sm text-neutral-500 dark:text-neutral-400">oportunidades convertidas en resultado</p></Panel>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">Pipeline de oportunidades</p>
            <h2 className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-50">Prioriza conversaciones y próximos pasos</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Cada tarjeta debe responder: qué oportunidad es, quién la lidera y qué ocurrirá después.</p>
          </div>
          <Link href="/mapa-stakeholder" className="inline-flex items-center gap-1 text-sm font-medium text-neutral-700 hover:text-brand-primary dark:text-neutral-200">
            Ver relaciones <ArrowUpRight size={15} />
          </Link>
        </div>
        <PlanGate
          locked={premiumLocked}
          label="Disponible en plan Premium"
          variant="showcase"
          title="Un CRM conectado al mercado energético"
          description="Convierte proyectos y relaciones de mercado en un pipeline compartido, priorizado y trazable."
          features={["Pipeline por etapa y responsable", "Vista para IPP, inversionistas, EPC y proveedores", "Alertas de acciones vencidas", "Contexto del proyecto, empresa y contacto"]}
        >
          <div className="flex flex-col gap-4">
            <details className="group rounded-2xl border border-brand-primary/30 bg-brand-surface/60 dark:bg-brand-primary/5">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 py-3 text-sm font-semibold text-brand-deep select-none [&::-webkit-details-marker]:hidden dark:text-brand-primary">
                <Plus size={16} /> Registrar oportunidad en el funnel
                <span className="hidden text-xs font-normal text-neutral-500 sm:inline">— vinculada a proyecto, empresa y contacto</span>
                <ChevronDown size={14} className="ml-auto transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-brand-primary/15 bg-white px-4 py-4 dark:bg-neutral-950">
                <NewOpportunityForm projects={projectOptions} />
              </div>
            </details>
            <OpportunityBoard opportunities={opportunities} />
          </div>
        </PlanGate>
      </section>

      <section className="grid gap-4 rounded-3xl border border-brand-primary/25 bg-gradient-to-br from-brand-surface via-white to-white p-6 md:grid-cols-[1fr_auto] md:items-center dark:via-neutral-950 dark:to-neutral-950">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-brand-deep uppercase dark:text-brand-primary"><Building2 size={14} /> Contexto antes del contacto</div>
          <h2 className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">Investiga la empresa detrás del proyecto</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">Revisa el grupo empresarial, las sociedades relacionadas y su cartera antes de preparar una reunión, propuesta o acercamiento comercial.</p>
        </div>
        <Link href="/mapa-stakeholder" className="inline-flex w-fit items-center gap-2 rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-ink">
          Ver empresas y relaciones <ArrowUpRight size={15} />
        </Link>
      </section>
    </div>
  );
}
