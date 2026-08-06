import type { Metadata } from "next";
import { Check, CreditCard, FileSignature, Headphones, ShieldCheck } from "lucide-react";
import { getAppLocale } from "@/lib/i18n";
import { PrimeInterestForm } from "../requerimientos/PrimeInterestForm";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getAppLocale();
  return { title: locale === "en" ? "Subscribe to Prime" : "Contratar Prime" };
}

export default async function ContratarPrimePage() {
  const locale = await getAppLocale();
  const en = locale === "en";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 pb-12">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-black via-[#272727] to-[#333333] px-6 py-10 text-white shadow-xl shadow-black/10 sm:px-9 sm:py-12">
        <span className="absolute -top-24 right-8 h-64 w-64 rounded-full border border-white/10" aria-hidden />
        <span className="absolute -right-10 -bottom-28 h-72 w-72 rounded-full bg-brand-primary/20 blur-3xl" aria-hidden />
        <div className="relative max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary">Transition LATAM Prime</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
            {en ? "Confirm your interest in subscribing to Prime" : "Confirme su interés en contratar Prime"}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
            {en
              ? "The Prime subscription is handled directly by our team. This process is separate from additional consulting services."
              : "La suscripción Prime es gestionada directamente por nuestro equipo. Este proceso es independiente de los servicios adicionales de consultoría."}
          </p>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: FileSignature, title: en ? "Service agreement" : "Contrato del plan", text: en ? "We send the agreement for review and signature." : "Enviamos el contrato para su revisión y firma." },
          { icon: CreditCard, title: en ? "Payment link" : "Enlace de pago", text: en ? "You receive a secure link after confirming the contracting details." : "Recibirá un enlace seguro una vez confirmados los datos." },
          { icon: Headphones, title: en ? "Direct contact" : "Contacto directo", text: en ? "We answer questions and coordinate activation with your team." : "Resolvemos consultas y coordinamos la activación con su equipo." },
        ].map(({ icon: Icon, title, text }) => (
          <article key={title} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <Icon size={20} className="text-brand-deep" />
            <h2 className="mt-4 text-sm font-semibold text-neutral-950">{title}</h2>
            <p className="mt-2 text-xs leading-5 text-neutral-500">{text}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-brand-primary/35 bg-gradient-to-br from-brand-surface via-white to-white p-6 shadow-lg shadow-brand-deep/5 sm:p-8">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-brand-deep" size={22} />
          <div>
            <h2 className="text-xl font-semibold text-neutral-950">{en ? "What happens when you confirm" : "Qué ocurre al confirmar"}</h2>
            <ul className="mt-4 space-y-3">
              {[
                en ? "We receive your contact details and confirmation by email." : "Recibimos por correo sus datos y la confirmación de interés.",
                en ? "We contact you directly with the agreement and payment instructions." : "Lo contactamos directamente con el contrato y las instrucciones de pago.",
                en ? "Your Prime access is activated once contracting is complete." : "Activamos su acceso Prime una vez completada la contratación.",
              ].map((item) => <li key={item} className="flex items-start gap-2 text-sm leading-6 text-neutral-600"><Check size={15} className="mt-1 shrink-0 text-brand-primary" />{item}</li>)}
            </ul>
          </div>
        </div>
        <div className="mt-7 border-t border-neutral-200 pt-6">
          <PrimeInterestForm locale={locale} />
        </div>
      </section>
    </div>
  );
}
