import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Panel } from "../components/Panel";
import { ServiceRequestForm } from "./ServiceRequestForm";
import { RotatingServicesPanel } from "./RotatingServicesPanel";
import { getAppLocale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getAppLocale();
  return { title: locale === "en" ? "Additional services" : "Servicios adicionales" };
}

export default async function RequerimientosPage() {
  const locale = await getAppLocale();
  const en = locale === "en";

  return (
    <div className="flex flex-col gap-8 pb-12">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-black via-[#272727] to-[#333333] px-6 py-9 text-white shadow-xl shadow-black/10 md:px-8 md:py-11">
        <span className="absolute -top-20 right-10 h-52 w-52 rounded-full border border-white/10" aria-hidden />
        <span className="absolute -right-10 -bottom-24 h-64 w-64 rounded-full bg-brand-primary/15 blur-2xl" aria-hidden />
        <h1 className="relative text-3xl font-semibold tracking-tight sm:text-4xl">{en ? "Additional services" : "Servicios adicionales"}</h1>
      </header>

      <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.72fr)]">
        <Panel className="border-neutral-200 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">{en ? "Request a proposal" : "Solicitar una propuesta"}</h2>
          <p className="mt-2 mb-7 text-sm leading-6 text-neutral-600">
            {en ? "Share the necessary context. We will review the scope before proposing a methodology, timeline and budget." : "Comparta el contexto necesario. Revisaremos el alcance antes de proponer una metodología, un plazo y un presupuesto."}
          </p>
          <ServiceRequestForm locale={locale} />
        </Panel>

        <RotatingServicesPanel locale={locale} />
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-neutral-950">{en ? "What happens next" : "Qué ocurre después"}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            en ? "We review the question and available context." : "Revisamos la pregunta y los antecedentes disponibles.",
            en ? "We clarify scope, deliverables and required information." : "Aclaramos el alcance, los entregables y la información necesaria.",
            en ? "We present a methodology, schedule and budget." : "Presentamos una metodología, un plazo y un presupuesto.",
          ].map((step) => <p key={step} className="flex items-start gap-2 text-xs leading-5 text-neutral-600"><Check size={14} className="mt-0.5 shrink-0 text-brand-primary" />{step}</p>)}
        </div>
      </section>
    </div>
  );
}
