"use client";

import { useActionState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { createServiceRequest, type ServiceRequestState } from "./actions";
import type { AppLocale } from "@/lib/i18n";

const initialState: ServiceRequestState = {};

const fieldClass =
  "mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-[#333333] focus:ring-2 focus:ring-neutral-200";

export function ServiceRequestForm({ locale = "es" }: { locale?: AppLocale }) {
  const [state, formAction, pending] = useActionState(createServiceRequest, initialState);

  if (state.success) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
        <CheckCircle2 className="mb-5 text-brand-primary" size={34} strokeWidth={1.7} />
        <h2 className="text-xl font-semibold tracking-tight text-neutral-950">{locale === "en" ? "Request received" : "Requerimiento recibido"}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-neutral-600">
          {locale === "en" ? "We will review the scope and contact you to define next steps and prepare a proposal." : "Revisaremos el alcance y nos pondremos en contacto con usted para definir los próximos pasos y preparar una propuesta."}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      <div>
        <label htmlFor="serviceType" className="text-sm font-medium text-neutral-800">{locale === "en" ? "Required service" : "Servicio requerido"}</label>
        <select id="serviceType" name="serviceType" required defaultValue="" className={fieldClass}>
          <option value="" disabled>{locale === "en" ? "Select an option" : "Seleccione una alternativa"}</option>
          <option value="market_study">{locale === "en" ? "Market study" : "Estudio de mercado"}</option>
          <option value="market_intelligence">{locale === "en" ? "Market intelligence" : "Inteligencia de mercado"}</option>
          <option value="project_intelligence">{locale === "en" ? "Project intelligence" : "Inteligencia de proyectos"}</option>
          <option value="commercial_strategy">{locale === "en" ? "Commercial strategy" : "Estrategia comercial"}</option>
          <option value="custom_analysis">{locale === "en" ? "Custom analysis" : "Análisis personalizado"}</option>
          <option value="other">{locale === "en" ? "Other request" : "Otro requerimiento"}</option>
        </select>
      </div>

      <div>
        <label htmlFor="description" className="text-sm font-medium text-neutral-800">{locale === "en" ? "What do you need to solve?" : "¿Qué necesita resolver?"}</label>
        <p className="mt-1 text-sm text-neutral-500">{locale === "en" ? "Describe the objective, expected scope and any relevant market, technology or project." : "Describa el objetivo, el alcance esperado y cualquier mercado, tecnología o proyecto relevante."}</p>
        <textarea
          id="description"
          name="description"
          required
          minLength={20}
          maxLength={4000}
          rows={7}
          placeholder={locale === "en" ? "For example: we need to size the BESS market in Chile and identify companies with projects approaching procurement..." : "Por ejemplo: necesitamos dimensionar el mercado BESS en Chile y reconocer las empresas con proyectos próximos a compras..."}
          className={`${fieldClass} resize-y`}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="desiredTiming" className="text-sm font-medium text-neutral-800">{locale === "en" ? "Expected timing" : "Plazo esperado"}</label>
          <select id="desiredTiming" name="desiredTiming" required defaultValue="this_month" className={fieldClass}>
            <option value="as_soon_as_possible">{locale === "en" ? "As soon as possible" : "Lo antes posible"}</option>
            <option value="this_month">{locale === "en" ? "This month" : "Durante este mes"}</option>
            <option value="this_quarter">{locale === "en" ? "This quarter" : "Durante este trimestre"}</option>
            <option value="exploratory">{locale === "en" ? "Exploratory" : "Exploratorio"}</option>
          </select>
        </div>
        <div>
          <label htmlFor="contactMethod" className="text-sm font-medium text-neutral-800">{locale === "en" ? "Preferred contact" : "Contacto preferido"}</label>
          <select id="contactMethod" name="contactMethod" required defaultValue="email" className={fieldClass}>
            <option value="email">{locale === "en" ? "Email" : "Correo"}</option>
            <option value="phone">{locale === "en" ? "Phone" : "Teléfono"}</option>
            <option value="meeting">{locale === "en" ? "Meeting" : "Reunión"}</option>
          </select>
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#333333] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send size={16} />
        {pending ? (locale === "en" ? "Sending..." : "Enviando...") : (locale === "en" ? "Send request" : "Enviar requerimiento")}
      </button>
    </form>
  );
}
