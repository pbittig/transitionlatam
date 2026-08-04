import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { RestablecerClaveForm } from "./RestablecerClaveForm";
import { RestablecerClaveClient } from "./RestablecerClaveClient";
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
            {locale === "en" ? "Set a new password" : "Defina su nueva clave"}
          </h1>
        </div>

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          {user ? <RestablecerClaveForm locale={locale} /> : <RestablecerClaveClient locale={locale} />}
        </div>
      </div>
    </div>
  );
}
