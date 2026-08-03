import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react";
import { ViewTransition } from "react";
import { EnergyVisual } from "../ingresar/EnergyVisual";
import { RegistroForm } from "./RegistroForm";
import { getAppLocale } from "@/lib/i18n";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

export const metadata: Metadata = {
  title: "Crear cuenta",
  description: "Crea tu cuenta Free de Transition LATAM y explora durante 14 días la inteligencia del mercado energético.",
};
export const dynamic = "force-dynamic";

export default async function RegistroPage() {
  const locale = await getAppLocale();
  return (
    <ViewTransition
      name="auth-flow"
      enter={{ "auth-forward": "auth-forward", "auth-back": "auth-back", default: "none" }}
      exit={{ "auth-forward": "auth-forward", "auth-back": "auth-back", default: "none" }}
      default="none"
    >
      <div className="grid min-h-full grid-cols-1 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="flex items-center justify-center bg-[linear-gradient(180deg,var(--brand-surface)_0px,#fff_340px)] p-6 py-10 dark:bg-[linear-gradient(180deg,#102624_0px,#171717_340px)]">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/tl-logo.png" alt="Transition LATAM" className="h-9 w-auto" />
            <LanguageSwitcher locale={locale} compact />
            <Link href="/ingresar" transitionTypes={["auth-back"]} className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-brand-deep dark:hover:text-brand-primary">
              <ArrowLeft size={13} /> {locale === "en" ? "Back to sign in" : "Volver a ingresar"}
            </Link>
          </div>

          <div className="mt-8">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">{locale === "en" ? "Create your business account" : "Crea tu cuenta corporativa"}</h1>
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              {locale === "en" ? "Complete your details to tailor the portal to your company and role in the energy market." : "Completa tus datos para personalizar el portal según tu empresa y rol en el mercado energético."}
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <RegistroForm locale={locale} />
          </div>

          <div className="mt-5 grid gap-2 text-xs text-neutral-500 sm:grid-cols-2 dark:text-neutral-400">
            {(locale === "en" ? ["No payment commitment", "Consolidated public information", "Immediate portal access", "Plans for business teams"] : ["Sin compromiso de pago", "Información pública consolidada", "Acceso inmediato al portal", "Planes para equipos de empresa"]).map((item) => (
              <span key={item} className="flex items-center gap-1.5"><Check size={13} className="text-brand-primary" /> {item}</span>
            ))}
          </div>

          <p className="mt-5 flex items-start gap-2 text-[10px] leading-5 text-neutral-400">
            <ShieldCheck size={13} className="mt-0.5 shrink-0" />
            {locale === "en" ? "Use a business email. Your information is used to create and manage access for your organization." : "Utiliza un correo corporativo. Tus datos se usan para crear y administrar el acceso de tu organización."}
          </p>
        </div>
        </div>

        <div className="hidden lg:block">
          <ViewTransition name="auth-visual" share="auth-visual">
            <EnergyVisual />
          </ViewTransition>
        </div>
      </div>
    </ViewTransition>
  );
}
