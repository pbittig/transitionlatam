import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bot,
  Building2,
  Check,
  Clock3,
  FileText,
  ListChecks,
  LockKeyhole,
  Network,
  UsersRound,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";

export const metadata: Metadata = { title: "Planes — Transition LATAM" };
export const dynamic = "force-dynamic";

const USD_CLP = 941.93;
const FX_DATE = "28 de julio de 2026";

const plans = [
  {
    code: "free",
    name: "Free",
    eyebrow: "Prueba sin costo",
    usd: 0,
    clp: 0,
    seats: 1,
    users: "1 usuario",
    description: "Para conocer la plataforma y comprobar si la información responde a las necesidades de tu equipo.",
    bestFor: "Personas evaluando la plataforma o equipos que necesitan validar rápidamente la cobertura disponible.",
    receives: ["Panorama de la matriz eléctrica", "Exploración inicial de proyectos futuros", "Vista de muestra de módulos avanzados"],
    outcome: "Confirmar si Transition LATAM cubre tu mercado y definir qué proyectos vale la pena analizar con mayor profundidad.",
    features: [
      "14 días de acceso gratuito",
      "Panorama general de infraestructura energética",
      "Vista resumida de proyectos futuros",
      "Muestras de las funciones incluidas en planes pagados",
    ],
    cta: "Elegir Free",
    featured: false,
  },
  {
    code: "lite",
    name: "Lite",
    eyebrow: "Análisis y monitoreo",
    usd: 1200,
    clp: Math.round(1200 * USD_CLP / 1000) * 1000,
    seats: 2,
    users: "2 usuarios",
    description: "Para equipos que necesitan revisar proyectos en detalle y recibir señales cuando cambian.",
    bestFor: "Equipos de desarrollo, ingeniería, proveedores y asesores que monitorean una cartera activa de proyectos.",
    receives: ["Fichas completas y cronología estimada", "Análisis dinámico por tecnología y etapa", "Monitoreo, alertas e historial de cambios"],
    outcome: "Priorizar proyectos, anticipar hitos y volver al equipo cuando aparece una señal relevante sin revisar manualmente toda la cartera.",
    features: [
      "Todo lo disponible en Free",
      "Acceso completo a las fichas de proyectos",
      "Listado completo de proyectos futuros",
      "Alertas e historial de cambios de proyectos",
      "2 cuentas para integrantes de la misma empresa",
    ],
    cta: "Elegir Lite",
    featured: false,
  },
  {
    code: "premium",
    name: "Premium",
    eyebrow: "Análisis y gestión comercial",
    usd: 1450,
    clp: Math.round(1450 * USD_CLP / 1000) * 1000,
    seats: 3,
    users: "3 usuarios",
    description: "Para equipos que además necesitan entender empresas, organizar oportunidades y preparar análisis.",
    bestFor: "Equipos comerciales, inversionistas, EPC y proveedores que convierten inteligencia de mercado en pipeline y ventas.",
    receives: ["Todo el análisis y monitoreo de Lite", "Empresas, grupos, SPV y contexto relacional", "CRM, Nexo y reportes asistidos"],
    outcome: "Pasar del proyecto detectado a una oportunidad gestionada, con contexto empresarial, responsable y próximo paso compartido.",
    features: [
      "Todo lo incluido en Lite",
      "Mapa de empresas, propietarios y sociedades de proyecto (SPV)",
      "Gestión comercial (CRM), oportunidades y próximos pasos",
      "Nexo para hacer preguntas sobre la plataforma",
      "Creación asistida de análisis y reportes",
      "3 cuentas para integrantes de la misma empresa",
    ],
    cta: "Elegir Premium",
    featured: true,
  },
] as const;

function formatClp(value: number) {
  return value.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
}

function formatUsd(value: number) {
  return value.toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default async function PlansPage() {
  const client = await createSupabaseServerClient();
  const profile = await getCurrentUserProfile(client);
  const currentPlan = profile?.planCode ?? "free";

  return (
    <div className="flex flex-col gap-10 pb-16">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-black via-[#272727] to-[#333333] px-6 py-10 text-white shadow-xl shadow-black/15 md:px-10 md:py-12">
        <span className="absolute -top-24 right-10 h-64 w-64 rounded-full border border-white/10" aria-hidden />
        <span className="absolute -right-16 -bottom-32 h-80 w-80 rounded-full bg-brand-primary/20 blur-3xl" aria-hidden />
        <div className="relative max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">Elige el nivel de inteligencia que necesita tu equipo.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/75 md:text-base">
            Un contrato anual por empresa, con cuentas de usuario incluidas y precios finales con IVA.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-[11px] font-medium text-white/75">
            <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1.5">Pago anual</span>
            <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1.5">IVA incluido</span>
            <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1.5">Usuarios por empresa incluidos</span>
          </div>
        </div>
      </section>

      <section className="grid items-stretch gap-5 lg:grid-cols-3" aria-label="Comparación de planes">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.code;
          return (
            <article
              key={plan.code}
              className={`relative flex flex-col overflow-hidden rounded-2xl border bg-white p-6 shadow-sm dark:bg-neutral-950 ${
                plan.featured
                  ? "border-brand-primary shadow-xl shadow-brand-deep/10 ring-1 ring-brand-primary/25"
                  : "border-neutral-200 dark:border-neutral-800"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold text-neutral-950 dark:text-white">{plan.name}</h2>
                {isCurrent && (
                  <span className="rounded-full bg-brand-surface px-2.5 py-1 text-[10px] font-semibold text-brand-deep dark:bg-brand-primary/10 dark:text-brand-primary">
                    Tu plan
                  </span>
                )}
              </div>
              {plan.usd === 0 ? (
                <div className="mt-6">
                  <p className="text-4xl font-semibold tracking-tight text-neutral-950 dark:text-white">14 días</p>
                  <p className="mt-1 text-sm text-neutral-500">sin costo · sin renovación automática</p>
                </div>
              ) : (
                <div className="mt-6">
                  <p className="flex items-baseline gap-1 text-neutral-950 dark:text-white">
                    <span className="text-4xl font-semibold tracking-tight">USD {plan.usd.toLocaleString("es-CL")}</span>
                    <span className="text-sm text-neutral-500">/año</span>
                  </p>
                  <p className="mt-1 text-sm font-medium text-brand-deep dark:text-brand-primary">
                    ≈ {formatClp(plan.clp)} CLP al año
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">IVA incluido</p>
                  <div className="mt-4 rounded-xl border border-brand-primary/30 bg-gradient-to-r from-brand-surface to-brand-primary/10 px-4 py-3 dark:from-brand-primary/10 dark:to-brand-primary/5">
                    <p className="text-xs font-medium text-neutral-600">
                      Costo mensual equivalente por usuario
                    </p>
                    <p className="mt-1 flex flex-wrap items-baseline gap-x-1 text-brand-ink dark:text-white">
                      <span className="text-2xl font-semibold">
                        USD {formatUsd(plan.usd / 12 / plan.seats)}
                      </span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">/ usuario / mes</span>
                    </p>
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      ≈ {formatClp(plan.clp / 12 / plan.seats)} CLP mensuales por usuario
                    </p>
                    <p className="mt-2 text-[10px] font-medium text-brand-deep dark:text-brand-primary">
                      Solo como referencia · el plan se contrata y paga por año
                    </p>
                  </div>
                </div>
              )}
              <div className="mt-5 inline-flex w-fit items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                <UsersRound size={14} className="text-brand-deep dark:text-brand-primary" />
                {plan.users} incluidos en la suscripción
              </div>
              <p className="mt-5 min-h-16 text-sm leading-6 text-neutral-600 dark:text-neutral-400">{plan.description}</p>
              <div className="mt-5 space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
                <div>
                  <p className="text-xs font-semibold text-neutral-800">Ideal para</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{plan.bestFor}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-800">Qué recibes</p>
                  <ul className="mt-2 space-y-1.5">
                    {plan.receives.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                        <Check size={12} className="mt-1 shrink-0 text-brand-primary" strokeWidth={2.5} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-800">Resultado esperado</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{plan.outcome}</p>
                </div>
              </div>
              <ul className="mt-5 flex flex-1 flex-col gap-3 border-t border-neutral-100 pt-5 dark:border-neutral-800">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-neutral-700 dark:text-neutral-300">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-primary/15 text-brand-deep dark:text-brand-primary">
                      <Check size={12} strokeWidth={2.5} />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <span className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
                  <LockKeyhole size={15} /> Plan actual
                </span>
              ) : (
                <a
                  href={`https://www.onixcg.com/contacto?plan=${plan.code}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`mt-7 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    plan.featured
                      ? "bg-brand-primary text-[#333333] hover:brightness-95"
                      : "border border-brand-deep text-brand-deep hover:bg-brand-surface dark:border-brand-primary dark:text-brand-primary"
                  }`}
                >
                  {plan.cta} <ArrowRight size={15} />
                </a>
              )}
            </article>
          );
        })}
      </section>

      <p className="-mt-5 text-center text-xs text-neutral-500 dark:text-neutral-400">
        Conversión referencial con dólar observado de {formatClp(USD_CLP)} por USD al {FX_DATE}. El cobro se realiza anualmente.
      </p>

      <section>
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">Módulos explicados en términos simples</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            Cada módulo responde una pregunta distinta: qué proyecto mirar, qué cambió, quién participa y cuál es el siguiente paso comercial.
          </p>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Building2,
              name: "Fichas completas",
              plan: "Lite",
              text: "Información técnica, empresa desarrolladora, ubicación, etapa, fechas y antecedentes del proyecto.",
            },
            {
              icon: Activity,
              name: "Monitoreo y alertas",
              plan: "Lite",
              text: "Avisos cuando cambia el estado, la capacidad, una fecha relevante, la conexión o un hito ambiental.",
            },
            {
              icon: Network,
              name: "Empresas y relaciones",
              plan: "Premium",
              text: "Vista de desarrolladores, sociedades de proyecto (SPV), propietarios y empresas relacionadas.",
            },
            {
              icon: ListChecks,
              name: "Gestión comercial (CRM)",
              plan: "Premium",
              text: "Organiza oportunidades, conversaciones, responsables y próximos pasos vinculados a cada proyecto.",
            },
            {
              icon: Bot,
              name: "Nexo",
              plan: "Premium",
              text: "Permite hacer preguntas en lenguaje natural y comparar información disponible en la plataforma.",
            },
            {
              icon: FileText,
              name: "Reportes asistidos",
              plan: "Premium",
              text: "Ayuda a convertir una consulta o selección de proyectos en un resumen estructurado para análisis.",
            },
          ].map(({ icon: Icon, name, plan, text }) => (
            <article key={name} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-surface text-brand-deep dark:bg-brand-primary/10 dark:text-brand-primary">
                  <Icon size={17} />
                </span>
                <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                  Desde {plan}
                </span>
              </div>
              <h3 className="mt-4 text-sm font-semibold text-neutral-950 dark:text-white">{name}</h3>
              <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 rounded-3xl border border-brand-primary/25 bg-gradient-to-br from-brand-surface via-white to-violet-50 p-6 md:grid-cols-[.9fr_1.1fr] md:p-8 dark:via-neutral-950 dark:to-violet-950/20">
        <div className="flex flex-col justify-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-deep text-white dark:bg-brand-primary dark:text-neutral-950">
            <Bot size={22} />
          </span>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">Nexo convierte preguntas en análisis estructurados.</h2>
          <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            La barra flotante permitirá consultar la información de la plataforma, comparar proyectos y preparar reportes. Tendrá un límite mensual de uso, que se informará antes del lanzamiento.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-neutral-600 dark:text-neutral-300">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm dark:bg-neutral-900"><Bot size={12} /> Chat con los datos</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm dark:bg-neutral-900"><FileText size={12} /> Creación de reportes</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm dark:bg-neutral-900"><Clock3 size={12} /> Límite mensual de uso</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-brand-primary/30 bg-white shadow-xl shadow-brand-deep/10 dark:bg-neutral-950">
          <div className="flex items-center justify-between bg-gradient-to-r from-brand-ink to-brand-deep px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary text-neutral-950"><Bot size={17} /></span>
              <div><p className="text-sm font-semibold">Nexo</p><p className="text-[10px] text-white/60">Preview de interfaz</p></div>
            </div>
          </div>
          <div className="space-y-3 p-4">
            <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-brand-deep px-4 py-3 text-sm text-white">
              Compara los proyectos BESS que entrarían en operación durante 2027.
            </div>
            <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-neutral-100 px-4 py-3 text-sm leading-6 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
              Encontré proyectos relevantes. Puedo ordenarlos por capacidad, desarrollador, región y madurez, o preparar un reporte ejecutivo.
            </div>
            <div className="flex gap-2">
              <span className="rounded-full bg-brand-surface px-3 py-1.5 text-[10px] font-medium text-brand-deep dark:bg-brand-primary/10 dark:text-brand-primary">Comparar proyectos</span>
              <span className="rounded-full bg-brand-surface px-3 py-1.5 text-[10px] font-medium text-brand-deep">Generar reporte</span>
            </div>
          </div>
        </div>
      </section>

      <div className="text-center">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">¿Necesitas confirmar el plan adecuado para tu empresa?</p>
        <Link href="https://www.onixcg.com/contacto" target="_blank" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-deep hover:underline dark:text-brand-primary">
          Hablar con ONIX <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
