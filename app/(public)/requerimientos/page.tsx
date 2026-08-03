import type { Metadata } from "next";
import { BarChart3, BriefcaseBusiness, ChartNoAxesCombined, SearchCheck } from "lucide-react";
import { Panel } from "../components/Panel";
import { ServiceRequestForm } from "./ServiceRequestForm";
import { getAppLocale } from "@/lib/i18n";

export const metadata: Metadata = { title: "Requerimientos" };

const services = [
  {
    title: "Estudios de mercado",
    description: "Dimensionamiento, tendencias, competencia y oportunidades por tecnología o segmento.",
    icon: ChartNoAxesCombined,
  },
  {
    title: "Inteligencia de mercado",
    description: "Análisis continuo para respaldar decisiones comerciales y de inversión.",
    icon: BarChart3,
  },
  {
    title: "Inteligencia de proyectos",
    description: "Revisión de carteras, actores, hitos, riesgos y ventanas comerciales.",
    icon: SearchCheck,
  },
  {
    title: "Estrategia y análisis a medida",
    description: "Respuestas específicas para desafíos que requieren una mirada especializada.",
    icon: BriefcaseBusiness,
  },
];

export default async function RequerimientosPage() {
  const locale = await getAppLocale();
  const localizedServices = locale === "en" ? [
    { title: "Market studies", description: "Market sizing, trends, competition and opportunities by technology or segment", icon: ChartNoAxesCombined },
    { title: "Market intelligence", description: "Continuous analysis to support commercial and investment decisions.", icon: BarChart3 },
    { title: "Project intelligence", description: "Portfolio, stakeholder, milestone, risk and commercial window reviews.", icon: SearchCheck },
    { title: "Strategy and custom analysis", description: "Specific answers for challenges that require a specialized perspective.", icon: BriefcaseBusiness },
  ] : services;
  return (
    <div className="flex flex-col gap-10">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">{locale === "en" ? "Tell us what you need to solve" : "Cuéntanos qué necesitas resolver"}</h1>
        <p className="mt-3 text-base leading-7 text-neutral-600">
          {locale === "en" ? "Transition LATAM combines sector data, analysis and market experience to prepare studies and solutions tailored to your objectives." : "Transition LATAM combina información sectorial, análisis y experiencia de mercado para preparar estudios y soluciones ajustadas a tus objetivos."}
        </p>
      </header>

      <section className="grid gap-px overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-4">
        {localizedServices.map(({ title, description, icon: Icon }) => (
          <article key={title} className="bg-white p-5">
            <Icon size={20} strokeWidth={1.7} className="mb-5 text-brand-primary" />
            <h2 className="font-semibold text-neutral-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">{description}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Panel className="border-neutral-200 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">{locale === "en" ? "Request a proposal" : "Solicitar una cotización"}</h2>
          <p className="mt-2 mb-7 text-sm leading-6 text-neutral-600">
            {locale === "en" ? "Share the necessary context. We will review the scope before proposing a methodology, timeline and budget." : "Comparte el contexto necesario. Revisaremos el alcance antes de proponerte una metodología, plazo y presupuesto."}
          </p>
          <ServiceRequestForm locale={locale} />
        </Panel>

        <aside className="border-t border-neutral-300 pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-7">
          <h2 className="font-semibold text-neutral-950">{locale === "en" ? "What happens next" : "Qué ocurre después"}</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            {locale === "en" ? "We review the request, clarify the scope with you and prepare a proposal. Submitting a request creates no commitment." : "Revisamos el requerimiento, aclaramos el alcance contigo y preparamos una propuesta. No se genera ningún compromiso al enviar la solicitud."}
          </p>
        </aside>
      </section>
    </div>
  );
}
