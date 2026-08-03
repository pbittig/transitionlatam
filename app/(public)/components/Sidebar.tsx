"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bell, CalendarDays, ChartNoAxesCombined, ClipboardList, ContactRound, LockKeyhole, LogIn, LogOut, Network, ShieldCheck } from "lucide-react";
import { logout } from "@/app/ingresar/actions";
import type { CurrentUserProfile } from "@/lib/data-access/userProfile";
import type { AppLocale } from "@/lib/i18n";
import { LanguageSwitcher } from "@/app/components/LanguageSwitcher";

// `gated: true` = la página ya maneja su propio candado para plan Free (ver
// PlanGate en cada page.tsx) — acá solo se refleja visualmente en el nav, nunca
// se decide acceso (mismo principio que docs/08-modelo-suscripciones.md §8.4).
function getNavItems(locale: AppLocale) {
  return locale === "en"
    ? [
        { href: "/proyectos", label: "Projects", icon: Activity, minPlan: "free" },
        { href: "/matriz", label: "Power matrix", icon: ChartNoAxesCombined, minPlan: "free" },
        { href: "/empresas", label: "Companies", icon: Network, minPlan: "premium" },
        { href: "/monitoreo", label: "Monitoring", icon: Bell, minPlan: "lite" },
        { href: "/crm", label: "CRM", icon: ContactRound, minPlan: "premium" },
        { href: "/requerimientos", label: "Requests", icon: ClipboardList, minPlan: "free" },
      ]
    : [
        { href: "/proyectos", label: "Proyectos", icon: Activity, minPlan: "free" },
        { href: "/matriz", label: "Matriz", icon: ChartNoAxesCombined, minPlan: "free" },
        { href: "/empresas", label: "Empresas", icon: Network, minPlan: "premium" },
        { href: "/monitoreo", label: "Monitoreo", icon: Bell, minPlan: "lite" },
        { href: "/crm", label: "CRM", icon: ContactRound, minPlan: "premium" },
        { href: "/requerimientos", label: "Requerimientos", icon: ClipboardList, minPlan: "free" },
      ];
}

export function Sidebar({
  isAdmin,
  userProfile,
  remainingTrialDays,
  locale,
}: {
  isAdmin: boolean;
  userProfile: CurrentUserProfile | null;
  remainingTrialDays: number | null;
  locale: AppLocale;
}) {
  const pathname = usePathname();
  const planCode = userProfile?.planCode ?? "free";
  const isFree = !isAdmin && planCode !== "lite" && planCode !== "premium";
  const baseNavItems = getNavItems(locale);
  const navItems = isAdmin ? [...baseNavItems, { href: "/admin", label: "Admin", icon: ShieldCheck, minPlan: "free" }] : baseNavItems;

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-neutral-200 bg-white/95 backdrop-blur-xl md:flex print:hidden">
      <Link href="/" className="flex items-center justify-center px-3 pt-6 pb-5 md:justify-start md:px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/tl-logo.png" alt="Transition LATAM" className="hidden h-9 w-auto md:block" />
        <span className="bg-brand-primary flex h-8 w-8 items-center justify-center rounded-md text-sm font-semibold text-white md:hidden">
          T
        </span>
      </Link>

      <div className="px-4 pb-3">
        <label htmlFor="country-selector" className="sr-only">
          {locale === "en" ? "Country" : "País"}
        </label>
        <select
          id="country-selector"
          defaultValue="cl"
          aria-label={locale === "en" ? "Select country" : "Seleccionar país"}
          className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 outline-none transition focus:border-[#333333]"
        >
          <option value="cl">🇨🇱 Chile</option>
        </select>
        <div className="mt-3 flex justify-end">
          <LanguageSwitcher locale={locale} />
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2 py-4 md:px-3">
        {navItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          const locked = !isAdmin && (
            item.minPlan === "premium"
              ? planCode !== "premium"
              : item.minPlan === "lite"
                ? isFree
                : false
          );

          return (
            <Link
              key={item.href}
              href={item.href}
              title={locked ? `${item.label} — ${locale === "en" ? "available on a higher plan" : "disponible en un plan superior"}` : undefined}
              className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-neutral-100 font-semibold text-neutral-950"
                  : locked
                    ? "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
              }`}
            >
              <Icon size={17} strokeWidth={1.75} className="shrink-0" />
              <span className="hidden min-w-0 flex-1 md:block">
                <span className="block truncate">{item.label}</span>
              </span>
              {locked && (
                <span className="hidden shrink-0 text-brand-primary md:inline-flex">
                  <LockKeyhole size={12} />
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {isFree && userProfile && (
        <div className="hidden px-3 pb-3 md:block">
          <Link
            href="/planes"
            className="block rounded-xl border border-neutral-300 bg-neutral-50 p-3 transition hover:border-neutral-500 hover:bg-white"
          >
            <div className="relative flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-[#333333]">Plan Free</p>
              {remainingTrialDays !== null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#333333] px-2 py-1 text-[9px] font-bold text-white">
                  <CalendarDays size={10} />
                  {remainingTrialDays > 1
                      ? `${remainingTrialDays} ${locale === "en" ? "days" : "días"}`
                    : remainingTrialDays === 1
                      ? locale === "en" ? "1 day" : "1 día"
                      : locale === "en" ? "Ended" : "Finalizado"}
                </span>
              )}
            </div>
            <p className="relative mt-2 text-xs font-semibold text-[#333333]">
              {remainingTrialDays === 0
                ? locale === "en" ? "Your Free period ended" : "Tu periodo Free terminó"
                : locale === "en" ? "Unlock commercial intelligence" : "Desbloquea inteligencia comercial"}
            </p>
            {remainingTrialDays !== null && remainingTrialDays > 0 && (
              <p className="relative mt-1 text-[10px] font-medium text-neutral-600">
                {locale === "en" ? `${remainingTrialDays} days of access left` : `Te quedan ${remainingTrialDays} ${remainingTrialDays === 1 ? "día" : "días"} de acceso`}
              </p>
            )}
            <p className="mt-1 text-[10px] leading-4 text-neutral-500">{locale === "en" ? "Compare plans" : "Comparar planes"} →</p>
          </Link>
        </div>
      )}

      {userProfile && (
        <div className="border-t border-neutral-100 px-2 py-2 md:px-3 dark:border-neutral-900">
          <Link
            href="/perfil"
            className="flex items-center gap-3 rounded-md px-1 py-2 text-sm transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900"
          >
            {userProfile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userProfile.avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="bg-brand-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white">
                {(userProfile.fullName ?? userProfile.email).charAt(0).toUpperCase()}
              </span>
            )}
            <span className="hidden min-w-0 flex-1 md:block">
              <span className="block truncate font-medium text-neutral-900 dark:text-neutral-50">
                {userProfile.fullName ?? userProfile.email}
              </span>
              <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">{locale === "en" ? "View profile" : "Ver perfil"}</span>
            </span>
          </Link>
        </div>
      )}

      <div className="border-t border-neutral-100 px-2 py-2 md:px-3 dark:border-neutral-900">
        {isAdmin || userProfile ? (
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              <LogOut size={17} strokeWidth={1.75} className="shrink-0" />
              <span className="hidden md:inline">{locale === "en" ? "Sign out" : "Cerrar sesión"}</span>
            </button>
          </form>
        ) : (
          <Link
            href="/ingresar"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            <LogIn size={17} strokeWidth={1.75} className="shrink-0" />
            <span className="hidden md:inline">{locale === "en" ? "Sign in" : "Ingresar"}</span>
          </Link>
        )}
      </div>

    </aside>
  );
}
