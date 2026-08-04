import type { Metadata } from "next";
import { BarChart3, BriefcaseBusiness, ChartNoAxesCombined, Check, FileCheck2, Route, SearchCheck, ShieldCheck } from "lucide-react";
import { Panel } from "../components/Panel";
import { ServiceRequestForm } from "./ServiceRequestForm";
import { getAppLocale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getAppLocale();
  return { title: locale === "en" ? "Services" : "Servicios" };
}

const services = [
  {
    title: "Estudios de mercado",
    description: "Dimensionamiento, tendencias, competencia y oportunidades por tecnología o segmento.",
    deliverable: "Estimación de mercado, impulsores de demanda, mapa competitivo y conclusiones ejecutivas.",
    icon: ChartNoAxesCombined,
  },
  {
    title: "Inteligencia de mercado",
    description: "Análisis continuo para respaldar decisiones comerciales y de inversión.",
    deliverable: "Lectura periódica de señales, cambios relevantes y sus implicancias para el negocio.",
    icon: BarChart3,
  },
  {
    title: "Inteligencia de proyectos",
    description: "Revisión de carteras, actores, hitos, riesgos y ventanas comerciales.",
    deliverable: "Selección priorizada de proyectos, actores relacionados, hitos y oportunidades de acción.",
    icon: SearchCheck,
  },
  {
    title: "Estrategia y análisis a medida",
    description: "Respuestas específicas para desafíos que requieren una mirada especializada.",
    deliverable: "Hipótesis, análisis, escenarios y recomendación adaptados a una decisión concreta.",
    icon: BriefcaseBusiness,
  },
];

export default async function RequerimientosPage() {
  const locale = await getAppLocale();
  const localizedServices = locale === "en" ? [
    { title: "Market studies", description: "Market sizing, trends, competition and opportunities by technology or segment.", deliverable: "Market estimate, demand drivers, competitive map and executive conclusions.", icon: ChartNoAxesCombined },
    { title: "Market intelligence", description: "Continuous analysis to support commercial and investment decisions.", deliverable: "Periodic reading of signals, relevant changes and business implications.", icon: BarChart3 },
    { title: "Project intelligence", description: "Portfolio, stakeholder, milestone, risk and commercial window reviews.", deliverable: "Prioritized projects, related stakeholders, milestones and action opportunities.", icon: SearchCheck },
    { title: "Strategy and custom analysis", description: "Specific answers for challenges that require a specialized perspective.", deliverable: "Hypotheses, analysis, scenarios and a recommendation tailored to a specific decision.", icon: BriefcaseBusiness },
  ] : services;
  return (
    <div className="flex flex-col gap-10">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-black via-[#272727] to-[#333333] px-6 py-9 text-white shadow-xl shadow-black/10 md:px-8 md:py-11">
        <span className="absolute -top-20 right-10 h-52 w-52 rounded-full border border-white/10" aria-hidden />
        <span className="absolute -right-10 -bottom-24 h-64 w-64 rounded-full bg-brand-primary/15 blur-2xl" aria-hidden />
        <div className="relative max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{locale === "en" ? "Services" : "Servicios"}</h1>
          <p className="mt-3 text-sm leading-6 text-white/75 md:text-base">
            {locale === "en" ? "Sector data, structured analysis and market experience to answer concrete commercial, investment and strategy questions." : "Información sectorial, análisis estructurado y experiencia de mercado para responder preguntas concretas de negocio, inversión y estrategia."}
          </p>
        </div>
      </header>

      <section>
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">{locale === "en" ? "Analysis designed to support a decision" : "Análisis orientado a respaldar una decisión"}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">{locale === "en" ? "Each engagement begins with the decision to be made and ends with clear findings, supporting evidence and recommended next steps." : "Cada servicio comienza por la decisión que debe tomarse y concluye con hallazgos claros, evidencia de respaldo y próximos pasos recomendados."}</p>
      </section>

      <section className="grid gap-px overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-4">
        {localizedServices.map(({ title, description, deliverable, icon: Icon }) => (
          <article key={title} className="bg-white p-5">
            <Icon size={20} strokeWidth={1.7} className="mb-5 text-brand-primary" />
            <h2 className="font-semibold text-neutral-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">{description}</p>
            <p className="mt-4 border-t border-neutral-100 pt-4 text-xs leading-5 text-neutral-500"><span className="font-semibold text-neutral-700">{locale === "en" ? "Typical output:" : "Entregable habitual:"}</span> {deliverable}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { icon: FileCheck2, title: locale === "en" ? "Decision-ready output" : "Entregable ejecutivo", text: locale === "en" ? "Conclusions are structured for discussion and decision-making, not only as a collection of data." : "Conclusiones estructuradas para facilitar la discusión y la toma de decisiones, no solo una recopilación de datos." },
          { icon: ShieldCheck, title: locale === "en" ? "Traceable evidence" : "Evidencia trazable", text: locale === "en" ? "Sources, assumptions and limitations are identified so the analysis can be reviewed and updated." : "Fuentes, supuestos y limitaciones identificados para que el análisis pueda revisarse y actualizarse." },
          { icon: Route, title: locale === "en" ? "Clear next steps" : "Próximos pasos claros", text: locale === "en" ? "Recommendations translate findings into priorities, actions and questions that still require validation." : "Recomendaciones que convierten los hallazgos en prioridades, acciones y preguntas que aún requieren validación." },
        ].map(({ icon: Icon, title, text }) => <article key={title} className="rounded-2xl border border-neutral-200 bg-white p-5"><Icon size={18} className="text-brand-primary" /><h3 className="mt-4 font-semibold text-neutral-950">{title}</h3><p className="mt-2 text-sm leading-6 text-neutral-600">{text}</p></article>)}
      </section>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Panel className="border-neutral-200 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">{locale === "en" ? "Request a proposal" : "Solicitar una propuesta"}</h2>
          <p className="mt-2 mb-7 text-sm leading-6 text-neutral-600">
            {locale === "en" ? "Share the necessary context. We will review the scope before proposing a methodology, timeline and budget." : "Comparta el contexto necesario. Revisaremos el alcance antes de proponer una metodología, un plazo y un presupuesto."}
          </p>
          <ServiceRequestForm locale={locale} />
        </Panel>

        <aside className="border-t border-neutral-300 pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-7">
          <h2 className="font-semibold text-neutral-950">{locale === "en" ? "What happens next" : "Qué ocurre después"}</h2>
          <ol className="mt-4 space-y-4">
            {[
              locale === "en" ? "We review the question and available context." : "Revisamos la pregunta y los antecedentes disponibles.",
              locale === "en" ? "We clarify scope, deliverables and required information." : "Aclaramos el alcance, los entregables y la información necesaria.",
              locale === "en" ? "We present a methodology, schedule and budget." : "Presentamos una metodología, un plazo y un presupuesto.",
            ].map((step, index) => <li key={step} className="flex gap-3 text-sm leading-6 text-neutral-600"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-surface text-xs font-semibold text-brand-deep">{index + 1}</span>{step}</li>)}
          </ol>
          <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-neutral-500"><Check size={14} className="mt-0.5 shrink-0 text-brand-primary" />{locale === "en" ? "Submitting a request creates no commitment." : "El envío de una solicitud no genera compromiso alguno."}</p>
        </aside>
      </section>
    </div>
  );
}
