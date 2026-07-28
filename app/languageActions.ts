"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { isAppLocale, LANGUAGE_COOKIE, type AppLocale } from "@/lib/i18n";

export async function setLanguage(locale: AppLocale): Promise<{ success: boolean }> {
  if (!isAppLocale(locale)) return { success: false };

  const cookieStore = await cookies();
  cookieStore.set(LANGUAGE_COOKIE, locale, {
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    sameSite: "lax",
    httpOnly: true,
  });

  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (user) {
    await client.from("user_profile").update({ preferred_language: locale }).eq("auth_user_id", user.id);
  }

  revalidatePath("/", "layout");
  return { success: true };
}
