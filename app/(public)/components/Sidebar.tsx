"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, Bell, CalendarDays, ChartNoAxesCombined, ContactRound, Network, LockKeyhole, LogIn, LogOut, ShieldCheck } from "lucide-react";
import { logout } from "@/app/login/actions";
import type { CurrentUserProfile } from "@/lib/data-access/userProfile";
import type { AppLocale } from "@/lib/i18n";

// `gated: true` = la página ya maneja su propio candado para plan Free (ver
// PlanGate en cada page.tsx) — acá solo se refleja visualmente en el nav, nunca
// se decide acceso (mismo principio que docs/08-modelo-suscripciones.md §8.4).
function getNavItems(locale: AppLocale) {
  return locale === "en"
    ? [
        { href: "/mercado", label: "Power market", icon: ChartNoAxesCombined, minPlan: "free" },
        { href: "/proyectos-esperados", label: "Future projects", icon: Activity, minPlan: "free" },
        { href: "/analisis-dinamico", label: "Dynamic analysis", icon: BarChart3, minPlan: "lite" },
        { href: "/mapa-stakeholder", label: "Companies & relations", description: "Groups, SPVs and projects", icon: Network, minPlan: "premium" },
        { href: "/crm", label: "CRM", description: "Pipeline and next steps", icon: ContactRound, minPlan: "premium" },
        { href: "/alertas", label: "Tracking", description: "Alerts and key changes", icon: Bell, minPlan: "lite" },
      ]
    : [
        { href: "/mercado", label: "Matriz eléctrica", icon: ChartNoAxesCombined, minPlan: "free" },
        { href: "/proyectos-esperados", label: "Proyectos futuros", icon: Activity, minPlan: "free" },
        { href: "/analisis-dinamico", label: "Análisis dinámico", icon: BarChart3, minPlan: "lite" },
        { href: "/mapa-stakeholder", label: "Empresas y relaciones", description: "Grupos, SPV y proyectos", icon: Network, minPlan: "premium" },
        { href: "/crm", label: "CRM", description: "Pipeline y próximos pasos", icon: ContactRound, minPlan: "premium" },
        { href: "/alertas", label: "Seguimiento", description: "Alertas y cambios clave", icon: Bell, minPlan: "lite" },
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
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-brand-primary/20 bg-white/95 shadow-[8px_0_30px_rgba(18,107,100,0.04)] backdrop-blur-xl md:flex dark:border-brand-primary/15 dark:bg-neutral-950/95 print:hidden">
      <Link href="/" className="flex items-center justify-center px-3 pt-6 pb-5 md:justify-start md:px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/tl-logo.png" alt="Transition LATAM" className="hidden h-9 w-auto md:block" />
        <span className="bg-brand-primary flex h-8 w-8 items-center justify-center rounded-md text-sm font-semibold text-white md:hidden">
          T
        </span>
      </Link>

      <div className="hidden px-5 pb-3 md:block">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-neutral-400 uppercase dark:text-neutral-500">
          {locale === "en" ? "Project intelligence" : "Inteligencia de proyectos"}
        </p>
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
          🇨🇱 Chile
        </span>
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
              title={locked ? `${item.label} — ${locale === "en" ? "see what is included" : "conoce lo que incluye"}` : undefined}
              className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-brand-surface font-medium text-brand-ink dark:text-neutral-50"
                  : locked
                    ? "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
              }`}
            >
              {active && <span className="bg-brand-primary absolute inset-y-1 left-0 w-0.5 rounded-full" aria-hidden />}
              <Icon size={17} strokeWidth={1.75} className="shrink-0" />
              <span className="hidden min-w-0 flex-1 md:block">
                <span className="block truncate">{item.label}</span>
                {locked && "description" in item && (
                  <span className="mt-0.5 block truncate text-[10px] font-normal text-neutral-400 dark:text-neutral-500">
                    {item.description}
                  </span>
                )}
              </span>
              {locked && (
                <span className="hidden shrink-0 items-center gap-1 rounded-full border border-neutral-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-neutral-500 md:inline-flex dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                  <LockKeyhole size={9} /> {item.minPlan === "premium" ? "Premium" : "Lite+"}
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
            className="relative block overflow-hidden rounded-xl border border-brand-primary/40 bg-gradient-to-br from-brand-surface via-white to-brand-primary/15 p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-primary/70 hover:shadow-md dark:via-neutral-900 dark:to-brand-primary/10"
          >
            <span className="absolute -top-8 -right-8 h-20 w-20 rounded-full bg-brand-primary/20 blur-xl" aria-hidden />
            <div className="relative flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold tracking-wider text-brand-deep uppercase dark:text-brand-primary">Plan Free</p>
              {remainingTrialDays !== null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-deep px-2 py-1 text-[9px] font-bold text-white dark:bg-brand-primary dark:text-neutral-950">
                  <CalendarDays size={10} />
                  {remainingTrialDays > 1
                      ? `${remainingTrialDays} ${locale === "en" ? "days" : "días"}`
                    : remainingTrialDays === 1
                      ? locale === "en" ? "1 day" : "1 día"
                      : locale === "en" ? "Ended" : "Finalizado"}
                </span>
              )}
            </div>
            <p className="relative mt-2 text-xs font-semibold text-brand-ink dark:text-neutral-100">
              {remainingTrialDays === 0
                ? locale === "en" ? "Your Free period ended" : "Tu periodo Free terminó"
                : locale === "en" ? "Unlock commercial intelligence" : "Desbloquea inteligencia comercial"}
            </p>
            {remainingTrialDays !== null && remainingTrialDays > 0 && (
              <p className="relative mt-1 text-[10px] font-medium text-brand-deep dark:text-brand-primary">
                {locale === "en" ? `${remainingTrialDays} days of access left` : `Te quedan ${remainingTrialDays} ${remainingTrialDays === 1 ? "día" : "días"} de acceso`}
              </p>
            )}
            <p className="mt-1 text-[10px] leading-4 text-neutral-500 dark:text-neutral-400">{locale === "en" ? "Contacts, relations, CRM and alerts." : "Contactos, relaciones, CRM y alertas."}</p>
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
        {isAdmin ? (
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
            href="/login"
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
