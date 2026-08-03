import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";
import { ProfileForm } from "./ProfileForm";
import { getAppLocale } from "@/lib/i18n";

export const metadata: Metadata = { title: "Mi perfil" };
export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const locale = await getAppLocale();
  const client = await createSupabaseServerClient();
  const profile = await getCurrentUserProfile(client);
  if (!profile) redirect("/ingresar");

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">{locale === "en" ? "My profile" : "Mi perfil"}</h1>
      <p className="mt-1 mb-8 text-sm text-neutral-500 dark:text-neutral-400">
        {locale === "en" ? "Your name, company and photo are visible only to you and the ONIX team." : "Tu nombre, empresa y foto — visibles solo para ti y el equipo de ONIX."}
      </p>
      <ProfileForm profile={profile} locale={locale} />
    </div>
  );
}
