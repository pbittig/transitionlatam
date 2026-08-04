import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { RestablecerClaveForm } from "./RestablecerClaveForm";
import { getAppLocale } from "@/lib/i18n";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

export const metadata: Metadata = { title: "Restablecer clave" };
export const dynamic = "force-dynamic";

export default async function RestablecerClavePage() {
  const locale = await getAppLocale();
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  return (
    <div className="flex min-h-full items-center justify-center bg-[linear-gradient(180deg,var(--brand-surface)_0px,#fff_340px)] p-6 py-10 dark:bg-[linear-gradient(180deg,#102624_0px,#171717_340px)]">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tl-logo.png" alt="Transition LATAM" className="h-9 w-auto" />
          <LanguageSwitcher locale={locale} compact />
        </div>

        <div className="mt-8">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">
            {locale === "en" ? "Set a new password" : "Define tu clave nueva"}
          </h1>
        </div>

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          {user ? (
            <RestablecerClaveForm locale={locale} />
          ) : (
            <div className="flex flex-col gap-3 text-sm text-neutral-600 dark:text-neutral-400">
              <p>
                {locale === "en"
                  ? "This link is invalid or has expired."
                  : "Este link no es válido o ya venció."}
              </p>
              <Link href="/recuperar-clave" className="font-semibold text-brand-deep hover:underline dark:text-brand-primary">
                {locale === "en" ? "Request a new link" : "Solicitar un link nuevo"}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
