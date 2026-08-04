import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RecuperarClaveForm } from "./RecuperarClaveForm";
import { getAppLocale } from "@/lib/i18n";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

export const metadata: Metadata = { title: "Recuperar clave" };
export const dynamic = "force-dynamic";

export default async function RecuperarClavePage() {
  const locale = await getAppLocale();
  return (
    <div className="flex min-h-full items-center justify-center bg-[linear-gradient(180deg,var(--brand-surface)_0px,#fff_340px)] p-6 py-10 dark:bg-[linear-gradient(180deg,#102624_0px,#171717_340px)]">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tl-logo.png" alt="Transition LATAM" className="h-9 w-auto" />
          <LanguageSwitcher locale={locale} compact />
          <Link
            href="/ingresar"
            className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-brand-deep dark:hover:text-brand-primary"
          >
            <ArrowLeft size={13} /> {locale === "en" ? "Back to sign in" : "Volver a ingresar"}
          </Link>
        </div>

        <div className="mt-8">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">
            {locale === "en" ? "Reset your password" : "Recupere su clave"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            {locale === "en"
              ? "Enter your account email and we'll send you a link to set a new password."
              : "Ingrese el correo de su cuenta y enviaremos un enlace para definir una clave nueva."}
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <RecuperarClaveForm locale={locale} />
        </div>
      </div>
    </div>
  );
}
