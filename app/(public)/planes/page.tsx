import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowRight, Building2, Check, FileText, ListChecks, LockKeyhole, Network, UsersRound } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";
import { getAppLocale } from "@/lib/i18n";
import { localizedRoute } from "@/lib/localizedRoutes";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getAppLocale();
  return { title: locale === "en" ? "Plans — Transition LATAM" : "Planes — Transition LATAM" };
}

export const dynamic = "force-dynamic";

const USD_CLP = 941.93;

function formatClp(value: number) {
  return value.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
}

export default async function PlansPage() {
  const client = await createSupabaseServerClient();
  const [profile, locale] = await Promise.all([getCurrentUserProfile(client), getAppLocale()]);
  const en = locale === "en";
  const currentPlan = profile?.planCode ?? "free";
  const plans = [
    {
      code: "free",
      name: "Free",
      usd: 0,
      clp: 0,
      users: en ? "1 user" : "1 usuario",
      description: en ? "Explore the platform and confirm whether its information meets your team's needs." : "Para conocer la plataforma y comprobar si la información responde a las necesidades de su equipo.",
      bestFor: en ? "People evaluating the platform or teams that need to quickly validate the available coverage." : "Personas evaluando la plataforma o equipos que necesitan validar rápidamente la cobertura disponible.",
      receives: en ? ["Overview of the electricity system", "Initial exploration of future projects", "Sample view of advanced modules"] : ["Panorama de la matriz eléctrica", "Exploración inicial de proyectos futuros", "Vista de muestra de módulos avanzados"],
      outcome: en ? "Confirm whether Transition LATAM covers your market and identify which projects deserve deeper analysis." : "Confirmar si Transition LATAM cubre su mercado y definir qué proyectos conviene analizar con mayor profundidad.",
      features: en ? ["14 days of free access", "Energy infrastructure overview", "Summary view of future projects", "Samples of features included in paid plans"] : ["14 días de acceso gratuito", "Panorama general de infraestructura energética", "Vista resumida de proyectos futuros", "Muestras de las funciones incluidas en planes pagados"],
      cta: en ? "Choose Free" : "Elegir Free",
      featured: false,
    },
    {
      code: "premium",
      name: "Prime",
      usd: 1600,
      clp: Math.round(1600 * USD_CLP / 1000) * 1000,
      semiannualUsd: 950,
      semiannualClp: Math.round(950 * USD_CLP / 1000) * 1000,
      users: en ? "3 users" : "3 usuarios",
      description: en ? "For teams that also need to understand companies, manage opportunities and prepare analyses." : "Para equipos que además necesitan entender empresas, organizar oportunidades y preparar análisis.",
      bestFor: en ? "Commercial teams, investors, EPCs and suppliers that turn market intelligence into pipeline and sales." : "Equipos comerciales, inversionistas, EPC y proveedores que convierten inteligencia de mercado en pipeline y ventas.",
      receives: en ? ["Complete project analysis and tracking", "Companies, groups, SPVs and relationship context", "CRM and assisted reporting"] : ["Análisis completo y seguimiento de proyectos", "Empresas, grupos, SPV y contexto relacional", "CRM y reportes asistidos"],
      outcome: en ? "Move from a detected project to a managed opportunity, with company context, an owner and a shared next step." : "Pasar del proyecto detectado a una oportunidad gestionada, con contexto empresarial, responsable y próximo paso compartido.",
      features: en ? ["Everything included in Free", "Full access to project profiles, analysis and tracking", "Map of companies, owners and project entities (SPVs)", "Commercial management (CRM), opportunities and next steps", "Assisted creation of analyses and reports", "3 accounts for members of the same company"] : ["Todo lo disponible en Free", "Acceso completo a fichas, análisis y seguimiento", "Mapa de empresas, propietarios y sociedades de proyecto (SPV)", "Gestión comercial (CRM), oportunidades y próximos pasos", "Creación asistida de análisis y reportes", "3 cuentas para integrantes de la misma empresa"],
      cta: en ? "Choose Prime" : "Elegir Prime",
      featured: true,
    },
  ] as const;
  const modules = en ? [
    { icon: Building2, name: "Complete project profiles", text: "Technical information, developer, location, stage, dates and project background." },
    { icon: Activity, name: "Monitoring and alerts", text: "Notifications when status, capacity, a relevant date, connection or environmental milestone changes." },
    { icon: Network, name: "Companies and relationships", text: "View of developers, project entities (SPVs), owners and related companies." },
    { icon: ListChecks, name: "Commercial management (CRM)", text: "Organize opportunities, conversations, owners and next steps linked to each project." },
    { icon: FileText, name: "Assisted reports", text: "Turn a query or project selection into a structured summary for analysis." },
  ] : [
    { icon: Building2, name: "Fichas completas", text: "Información técnica, empresa desarrolladora, ubicación, etapa, fechas y antecedentes del proyecto." },
    { icon: Activity, name: "Monitoreo y alertas", text: "Avisos cuando cambia el estado, la capacidad, una fecha relevante, la conexión o un hito ambiental." },
    { icon: Network, name: "Empresas y relaciones", text: "Vista de desarrolladores, sociedades de proyecto (SPV), propietarios y empresas relacionadas." },
    { icon: ListChecks, name: "Gestión comercial (CRM)", text: "Organice oportunidades, conversaciones, responsables y próximos pasos vinculados a cada proyecto." },
    { icon: FileText, name: "Reportes asistidos", text: "Ayuda a convertir una consulta o selección de proyectos en un resumen estructurado para análisis." },
  ];

  return (
    <div className="flex flex-col gap-10 pb-16">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-black via-[#272727] to-[#333333] px-6 py-10 text-white shadow-xl shadow-black/15 md:px-10 md:py-12">
        <span className="absolute -top-24 right-10 h-64 w-64 rounded-full border border-white/10" aria-hidden />
        <span className="absolute -right-16 -bottom-32 h-80 w-80 rounded-full bg-brand-primary/20 blur-3xl" aria-hidden />
        <h1 className="relative max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">{en ? "Choose the level of intelligence your team needs." : "Seleccione el nivel de inteligencia que necesita su equipo."}</h1>
      </section>

      <section className="mx-auto grid w-full max-w-5xl items-stretch gap-5 md:grid-cols-2" aria-label={en ? "Plan comparison" : "Comparación de planes"}>
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.code;
          return (
            <article key={plan.code} className={`relative flex flex-col overflow-hidden rounded-2xl border bg-white p-6 shadow-sm dark:bg-neutral-950 ${plan.featured ? "border-brand-primary shadow-xl shadow-brand-deep/10 ring-1 ring-brand-primary/25" : "border-neutral-200 dark:border-neutral-800"}`}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold text-neutral-950 dark:text-white">{plan.name}</h2>
                {isCurrent && <span className="rounded-full bg-brand-surface px-2.5 py-1 text-[10px] font-semibold text-brand-deep dark:bg-brand-primary/10 dark:text-brand-primary">{en ? "Current plan" : "Plan actual"}</span>}
              </div>
              {plan.usd === 0 ? (
                <div className="mt-6"><p className="text-4xl font-semibold tracking-tight text-neutral-950 dark:text-white">{en ? "14 days" : "14 días"}</p><p className="mt-1 text-sm text-neutral-500">{en ? "free · no automatic renewal" : "sin costo · sin renovación automática"}</p></div>
              ) : (
                <div className="mt-6">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"><p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{en ? "Six months" : "Semestral"}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">USD {plan.semiannualUsd.toLocaleString("en-US")}</p><p className="mt-1 text-xs text-neutral-500">{en ? "for 6 months" : "por 6 meses"} · ≈ {formatClp(plan.semiannualClp)} CLP</p></div>
                    <div className="rounded-xl border border-brand-primary bg-brand-surface/60 p-4 dark:bg-brand-primary/10"><p className="text-xs font-semibold uppercase tracking-wide text-brand-deep dark:text-brand-primary">{en ? "Annual · best value" : "Anual · mejor valor"}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">USD {plan.usd.toLocaleString("en-US")}</p><p className="mt-1 text-xs text-neutral-500">{en ? "for 12 months" : "por 12 meses"} · ≈ {formatClp(plan.clp)} CLP</p></div>
                  </div>
                  <p className="mt-2 text-xs text-neutral-500">{en ? "Final prices include VAT." : "Precios finales con IVA incluido."}</p>
                </div>
              )}
              <div className="mt-5 inline-flex w-fit items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"><UsersRound size={14} className="text-brand-deep dark:text-brand-primary" />{plan.users} {en ? "included in the subscription" : "incluidos en la suscripción"}</div>
              <p className="mt-5 min-h-16 text-sm leading-6 text-neutral-600 dark:text-neutral-400">{plan.description}</p>
              <div className="mt-5 space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
                <div><p className="text-xs font-semibold text-neutral-800">{en ? "Best for" : "Ideal para"}</p><p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{plan.bestFor}</p></div>
                <div><p className="text-xs font-semibold text-neutral-800">{en ? "What you receive" : "Qué recibe"}</p><ul className="mt-2 space-y-1.5">{plan.receives.map((item) => <li key={item} className="flex items-start gap-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300"><Check size={12} className="mt-1 shrink-0 text-brand-primary" strokeWidth={2.5} />{item}</li>)}</ul></div>
                <div><p className="text-xs font-semibold text-neutral-800">{en ? "Expected outcome" : "Resultado esperado"}</p><p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{plan.outcome}</p></div>
              </div>
              <ul className="mt-5 flex flex-1 flex-col gap-3 border-t border-neutral-100 pt-5 dark:border-neutral-800">{plan.features.map((feature) => <li key={feature} className="flex items-start gap-2.5 text-sm text-neutral-700 dark:text-neutral-300"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-primary/15 text-brand-deep dark:text-brand-primary"><Check size={12} strokeWidth={2.5} /></span>{feature}</li>)}</ul>
              {isCurrent ? <span className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900"><LockKeyhole size={15} /> {en ? "Current plan" : "Plan actual"}</span> : <Link href={plan.code === "premium" ? localizedRoute("subscribe", locale) : "/registro"} className={`mt-7 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${plan.featured ? "bg-brand-primary text-[#333333] hover:brightness-95" : "border border-brand-deep text-brand-deep hover:bg-brand-surface dark:border-brand-primary dark:text-brand-primary"}`}>{plan.cta} <ArrowRight size={15} /></Link>}
            </article>
          );
        })}
      </section>

      <p className="-mt-5 text-center text-xs text-neutral-500 dark:text-neutral-400">{en ? `Reference conversion at an observed exchange rate of ${formatClp(USD_CLP)} per USD as of July 28, 2026. Prime is available for six or twelve months.` : `Conversión referencial con dólar observado de ${formatClp(USD_CLP)} por USD al 28 de julio de 2026. Prime puede contratarse por semestre o por año.`}</p>

      <section>
        <div className="max-w-2xl"><h2 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">{en ? "Modules explained simply" : "Módulos explicados en términos simples"}</h2><p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">{en ? "Each module answers a different question: which project to examine, what changed, who is involved and what the next commercial step is." : "Cada módulo responde una pregunta distinta: qué proyecto mirar, qué cambió, quién participa y cuál es el siguiente paso comercial."}</p></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{modules.map(({ icon: Icon, name, text }) => <article key={name} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"><div className="flex items-start justify-between gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-surface text-brand-deep dark:bg-brand-primary/10 dark:text-brand-primary"><Icon size={17} /></span><span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">{en ? "From Prime" : "Desde Prime"}</span></div><h3 className="mt-4 text-sm font-semibold text-neutral-950 dark:text-white">{name}</h3><p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{text}</p></article>)}</div>
      </section>

      <div className="text-center"><p className="text-sm text-neutral-600 dark:text-neutral-400">{en ? "Need help choosing the right plan for your company?" : "¿Necesita confirmar el plan adecuado para su empresa?"}</p><Link href={`${localizedRoute("services", locale)}?motivo=planes`} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-deep hover:underline dark:text-brand-primary">{en ? "Request information" : "Solicitar información"} <ArrowRight size={14} /></Link></div>
    </div>
  );
}
