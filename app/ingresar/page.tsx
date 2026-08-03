import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { ViewTransition } from "react";
import { IngresarForm } from "./IngresarForm";
import { EnergyVisual } from "./EnergyVisual";
import { getAppLocale } from "@/lib/i18n";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

export const metadata: Metadata = {
  title: "Ingresar",
  description: "Accede a Transition LATAM, inteligencia de mercado para proyectos, empresas y oportunidades de la transición energética.",
};
export const dynamic = "force-dynamic";

export default async function IngresarPage() {
  const locale = await getAppLocale();
  return (
    <ViewTransition
      name="auth-flow"
      enter={{ "auth-forward": "auth-forward", "auth-back": "auth-back", default: "none" }}
      exit={{ "auth-forward": "auth-forward", "auth-back": "auth-back", default: "none" }}
      default="none"
    >
      <div className="grid min-h-full grid-cols-1 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="hidden lg:block">
          <ViewTransition name="auth-visual" share="auth-visual">
            <EnergyVisual />
          </ViewTransition>
        </div>

        <div className="flex items-center justify-center bg-[linear-gradient(180deg,var(--brand-surface)_0px,#fff_300px)] p-6 py-10 dark:bg-[linear-gradient(180deg,#102624_0px,#171717_300px)]">
          <div className="w-full max-w-md">
            <div className="flex items-center justify-between gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/tl-logo.png" alt="Transition LATAM" className="h-9 w-auto" />
              <LanguageSwitcher locale={locale} />
            </div>

          <div className="mt-8 lg:hidden">
            <h1 className="text-2xl font-semibold leading-tight tracking-tight text-neutral-950 dark:text-white">
              {locale === "en" ? "Find projects, companies and opportunities before your next decision." : "Encuentra proyectos, empresas y oportunidades antes de tu próxima decisión."}
            </h1>
            <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              {locale === "en" ? "A connected view of the power matrix, future generation, storage and data center projects, and commercial relationships." : "Una visión conectada de la matriz eléctrica, los proyectos futuros —generación, almacenamiento y data centers— y las relaciones comerciales."}
            </p>
          </div>

          <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">{locale === "en" ? "Sign in to your portal" : "Ingresa a tu portal"}</h1>
            <p className="mt-1 mb-6 text-sm text-neutral-500 dark:text-neutral-400">{locale === "en" ? "Continue analyzing the market and your opportunities." : "Continúa analizando el mercado y tus oportunidades."}</p>
            <IngresarForm locale={locale} />
          </div>

          <div className="mt-5 rounded-2xl border border-brand-primary/25 bg-brand-surface/70 p-4 dark:bg-brand-primary/5">
            <p className="text-sm font-semibold text-brand-ink dark:text-white">{locale === "en" ? "Don't have an account yet?" : "¿Aún no tienes una cuenta?"}</p>
            <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
              {locale === "en" ? "Start with 14 free days to explore the platform. No credit card required." : "Comienza con 14 días Free para conocer la plataforma. No necesitas ingresar una tarjeta."}
            </p>
            <Link href="/registro" transitionTypes={["auth-forward"]} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3.5 py-2 text-sm font-semibold text-[#333333] transition hover:brightness-95">
              {locale === "en" ? "Create free account" : "Crear cuenta gratis"} <ArrowRight size={14} />
            </Link>
          </div>

          <div className="mt-6 grid gap-2 text-xs text-neutral-500 sm:grid-cols-2 dark:text-neutral-400">
            {(locale === "en" ? ["Consolidated public data", "Connected projects and companies", "Change monitoring", "Annual plans for teams"] : ["Datos públicos consolidados", "Proyectos y empresas conectados", "Seguimiento de cambios", "Planes anuales para equipos"]).map((item) => (
              <span key={item} className="flex items-center gap-1.5"><Check size={13} className="text-brand-primary" /> {item}</span>
            ))}
          </div>

          <p className="mt-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
            {locale === "en" ? "Want to compare coverage?" : "¿Quieres comparar el alcance?"}{" "}
            <Link href="/planes" className="font-semibold text-brand-deep hover:underline dark:text-brand-primary">{locale === "en" ? "View plans" : "Ver planes"}</Link>
          </p>

          <p className="mt-7 text-[10px] leading-relaxed text-neutral-400 dark:text-neutral-600">
            {locale === "en" ? "Transition LATAM is an ONIX Consulting Group brand. The platform consolidates and analyzes public information; it does not replace specialized legal, technical or financial review." : "Transition LATAM es una marca de ONIX Consulting Group. La plataforma consolida y analiza información proveniente de fuentes públicas; no reemplaza una revisión legal, técnica o financiera especializada."}
          </p>
          </div>
        </div>
      </div>
    </ViewTransition>
  );
}
