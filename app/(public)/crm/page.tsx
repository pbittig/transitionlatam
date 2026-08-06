import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  ChevronDown,
  CircleAlert,
  Clock3,
  Factory,
  Handshake,
  LockKeyhole,
  Plus,
  Wrench,
  Zap,
} from "lucide-react";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";
import { FreeFeaturePreview } from "../components/FreeFeaturePreview";
import { ModuleGuide } from "../components/ModuleGuide";
import { getOpportunityBoard, getOpportunityProjectOptions } from "@/lib/data-access/opportunities";
import { OpportunityBoard } from "./OpportunityBoard";
import { Panel } from "../components/Panel";
import { NewOpportunityForm } from "./NewOpportunityForm";
import { PlanGate } from "../components/PlanGate";
import { getAppLocale } from "@/lib/i18n";
import { CrmPreview } from "./CrmPreview";

export const metadata: Metadata = { title: "CRM" };
export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const locale = await getAppLocale();
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
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">CRM</h1>
          <p className="mt-3 text-neutral-600 dark:text-neutral-400">{locale === "en" ? "Sign in to access commercial tracking, contacts, conversations and proposals." : "Inicia sesión para acceder al seguimiento comercial — contactos, conversaciones y propuestas."}</p>
        </div>
        <Link href="/ingresar" className="inline-flex w-fit items-center gap-1 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-neutral-50 dark:text-neutral-900">{locale === "en" ? "Sign in" : "Ingresar"} <ArrowUpRight size={16} /></Link>
      </div>
    );
  }

  const premiumLocked = !admin && profile?.planCode !== "premium";
  const crmClient = admin
    ? (await import("@/lib/data-access/supabase-service-client")).createSupabaseServiceClient()
    : premiumLocked ? null : client;
  // Nunca se envían oportunidades reales al HTML bloqueado de un usuario Free.
  const [opportunities, projectOptions] = crmClient
    ? await Promise.all([getOpportunityBoard(crmClient), getOpportunityProjectOptions(crmClient)])
    : [[], []];
  const contactReady = opportunities.filter((item) => item.stage === "contacto").length;
  const inConversation = opportunities.filter((item) => item.stage === "reunion").length;
  const withNextStep = opportunities.filter((item) => item.nextStepAt).length;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = opportunities.filter((item) => item.nextStepAt && item.nextStepAt < today && !item.stage.startsWith("cierre_")).length;
  const active = opportunities.filter((item) => !item.stage.startsWith("cierre_")).length;
  const won = opportunities.filter((item) => item.stage === "cierre_ganado").length;

  return (
    <div className="flex flex-col gap-7">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-black via-[#272727] to-[#333333] px-6 py-9 text-white shadow-xl shadow-black/10 md:px-8 md:py-11">
        <span className="absolute -top-24 right-4 h-64 w-64 rounded-full border border-white/10" aria-hidden />
        <span className="absolute -right-10 -bottom-24 h-64 w-64 rounded-full bg-brand-primary/20 blur-2xl" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Customer Relationship Management (CRM)</h1>
          </div>
          <Link href="/proyectos" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-ink shadow-sm transition hover:-translate-y-0.5">
            {locale === "en" ? "Find projects" : "Buscar proyectos"} <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>

      <ModuleGuide
        purpose={locale === "en" ? "Turn identified projects into commercial opportunities with ownership, priority, next action and shared context." : "Convertir proyectos detectados en oportunidades comerciales con responsable, prioridad, próxima acción y contexto compartido."}
        deliverables={locale === "en" ? ["Opportunity pipeline by stage", "Owners, conversations and next steps", "Direct link to project, company and team"] : ["Pipeline de oportunidades por etapa", "Responsables, conversaciones y próximos pasos", "Vínculo directo con proyecto, empresa y equipo"]}
        howToUse={locale === "en" ? ["Select a project with potential", "Register the opportunity and its owner", "Update the next step until won or discarded"] : ["Seleccione un proyecto con potencial", "Registre la oportunidad y su responsable", "Actualice el próximo paso hasta cerrar o descartar"]}
        plan="Prime"
        upgradeMessage={locale === "en" ? "Prime combines market data, companies, CRM and assisted analysis in one commercial workflow." : "Prime une datos de mercado, empresas, CRM y análisis asistido en un mismo flujo comercial."}
        locale={locale}
      />

      <section aria-labelledby="crm-role-title">
        <h2 id="crm-role-title" className="text-xl font-semibold text-neutral-950 dark:text-white">{locale === "en" ? "Use it according to your role in the ecosystem" : "Utilice el CRM según su rol en el ecosistema"}</h2>
        <p className="mt-2 text-sm text-neutral-500">{locale === "en" ? "Organize opportunities according to your company's role in the energy market." : "Organice las oportunidades de acuerdo con la función de su empresa en el mercado energético."}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { icon: Zap, role: "IPP / Developer", value: locale === "en" ? "Partners, land, connection and competing portfolios" : "Socios, terrenos, conexión y cartera competidora" },
            { icon: BadgeDollarSign, role: locale === "en" ? "Investor" : "Inversionista", value: locale === "en" ? "Assets, counterparties and capital opportunities" : "Activos, contrapartes y oportunidades de capital" },
            { icon: Wrench, role: locale === "en" ? "EPC / Contractor" : "EPC / Contratista", value: locale === "en" ? "Projects approaching engineering and construction" : "Proyectos próximos a ingeniería y construcción" },
            { icon: Factory, role: "Vendor", value: locale === "en" ? "Potential demand for equipment and technology" : "Demanda potencial de equipos y tecnología" },
            { icon: Handshake, role: locale === "en" ? "Advisor / Services" : "Asesor / Servicios", value: locale === "en" ? "Permits, studies, structuring and expert support" : "Permisos, estudios, estructuración y apoyo experto" },
          ].map(({ icon: Icon, role, value }) => (
            <article key={role} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-surface text-brand-deep dark:bg-brand-primary/10 dark:text-brand-primary"><Icon size={17} /></span>
              <h3 className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{role}</h3>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={locale === "en" ? "Opportunity summary" : "Resumen de oportunidades"}>
        <Panel className="border-neutral-200 p-4"><div className="flex items-center gap-2 text-xs font-medium text-neutral-500"><BriefcaseBusiness size={15} className="text-brand-primary" /> {locale === "en" ? "Active pipeline" : "Pipeline activo"}</div><p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-900"><PlanGate locked={premiumLocked} label="Prime">{active}</PlanGate></p><p className="text-sm text-neutral-500">{locale === "en" ? `${contactReady} to contact · ${inConversation} in meetings` : `${contactReady} por contactar · ${inConversation} en reunión`}</p></Panel>
        <Panel className="border-neutral-200 p-4"><div className="flex items-center gap-2 text-xs font-medium text-neutral-500"><CircleAlert size={15} className="text-brand-primary" /> {locale === "en" ? "Needs attention" : "Requieren atención"}</div><p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-900"><PlanGate locked={premiumLocked} label="Prime">{overdue}</PlanGate></p><p className="text-sm text-neutral-500">{locale === "en" ? "overdue actions to resolve" : "acciones vencidas que conviene resolver"}</p></Panel>
        <Panel className="border-neutral-200 p-4"><div className="flex items-center gap-2 text-xs font-medium text-neutral-500"><Clock3 size={15} className="text-brand-primary" /> {locale === "en" ? "With next action" : "Con próxima acción"}</div><p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-900"><PlanGate locked={premiumLocked} label="Prime">{withNextStep}</PlanGate></p><p className="text-sm text-neutral-500">{locale === "en" ? "opportunities with scheduled follow-up" : "oportunidades con seguimiento programado"}</p></Panel>
        <Panel className="border-neutral-200 p-4"><div className="flex items-center gap-2 text-xs font-medium text-neutral-500"><Handshake size={15} className="text-brand-primary" /> {locale === "en" ? "Won" : "Ganadas"}</div><p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-900"><PlanGate locked={premiumLocked} label="Prime">{won}</PlanGate></p><p className="text-sm text-neutral-500">{locale === "en" ? "opportunities converted into results" : "oportunidades convertidas en resultado"}</p></Panel>
      </section>

      {premiumLocked && (
        <FreeFeaturePreview
          locale={locale}
          wide
          title={locale === "en" ? "See how an opportunity is organized" : "Así se organiza una oportunidad"}
          description={locale === "en" ? "The CRM connects the project, account owner, commercial stage and next action in one card." : "El CRM conecta el proyecto, responsable, etapa comercial y próxima acción en una sola ficha."}
        >
          <CrmPreview locale={locale} />
        </FreeFeaturePreview>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{locale === "en" ? "Prioritize conversations and next steps" : "Prioriza conversaciones y próximos pasos"}</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{locale === "en" ? "Each card should show the opportunity, its owner and what happens next." : "Cada tarjeta debe responder: qué oportunidad es, quién la lidera y qué ocurrirá después."}</p>
          </div>
          <Link href="/propietarios" className="inline-flex items-center gap-1 text-sm font-medium text-neutral-700 hover:text-brand-primary dark:text-neutral-200">
            {locale === "en" ? "View relationships" : "Ver relaciones"} <ArrowUpRight size={15} />
          </Link>
        </div>
        <PlanGate
          locked={premiumLocked}
          label={locale === "en" ? "Available on Prime" : "Disponible en plan Prime"}
          variant="showcase"
          title={locale === "en" ? "A CRM connected to the energy market" : "Un CRM conectado al mercado energético"}
          description={locale === "en" ? "Turn projects and market relationships into a shared, prioritized and traceable pipeline." : "Convierta proyectos y relaciones de mercado en un pipeline compartido, priorizado y trazable."}
          features={locale === "en" ? ["Pipeline by stage and owner", "Views for IPPs, investors, EPCs and vendors", "Overdue action alerts", "Project, company and contact context"] : ["Pipeline por etapa y responsable", "Vista para IPP, inversionistas, EPC y proveedores", "Alertas de acciones vencidas", "Contexto del proyecto, empresa y contacto"]}
        >
          <div className="flex flex-col gap-4">
            <details className="group rounded-2xl border border-brand-primary/30 bg-brand-surface/60 dark:bg-brand-primary/5">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 py-3 text-sm font-semibold text-brand-deep select-none [&::-webkit-details-marker]:hidden dark:text-brand-primary">
                <Plus size={16} /> {locale === "en" ? "Add opportunity to the funnel" : "Registrar oportunidad en el funnel"}
                <span className="hidden text-xs font-normal text-neutral-500 sm:inline">— {locale === "en" ? "linked to a project, company and contact" : "vinculada a proyecto, empresa y contacto"}</span>
                <ChevronDown size={14} className="ml-auto transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-brand-primary/15 bg-white px-4 py-4 dark:bg-neutral-950">
                <NewOpportunityForm projects={projectOptions} locale={locale} />
              </div>
            </details>
            <OpportunityBoard opportunities={opportunities} projects={projectOptions} locale={locale} />
          </div>
        </PlanGate>
      </section>

      <section className="grid gap-4 rounded-3xl border border-brand-primary/25 bg-gradient-to-br from-brand-surface via-white to-white p-6 md:grid-cols-[1fr_auto] md:items-center dark:via-neutral-950 dark:to-neutral-950">
        <div>
          <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">{locale === "en" ? "Research the company behind the project" : "Investiga la empresa detrás del proyecto"}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">{locale === "en" ? "Review the corporate group, related entities and portfolio before preparing a meeting, proposal or commercial approach." : "Revise el grupo empresarial, las sociedades relacionadas y sus proyectos antes de preparar una reunión, propuesta o acercamiento comercial."}</p>
        </div>
        <Link href="/propietarios" className="inline-flex w-fit items-center gap-2 rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-ink">
          {locale === "en" ? "View companies and relationships" : "Ver empresas y relaciones"} <ArrowUpRight size={15} />
        </Link>
      </section>
    </div>
  );
}
