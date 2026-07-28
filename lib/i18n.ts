import { cookies } from "next/headers";

export const SUPPORTED_LOCALES = ["es", "en"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export const LANGUAGE_COOKIE = "transition-locale";

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === "es" || value === "en";
}

export async function getAppLocale(): Promise<AppLocale> {
  const value = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  return isAppLocale(value) ? value : "es";
}
