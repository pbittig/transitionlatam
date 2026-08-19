"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Eye, CalendarDays, ChartNoAxesCombined, ClipboardList, ContactRound, LockKeyhole, LogIn, LogOut, Network, Share2, ShieldCheck } from "lucide-react";
import { logout } from "@/app/ingresar/actions";
import type { CurrentUserProfile } from "@/lib/data-access/userProfile";
import type { AppLocale } from "@/lib/i18n";
import { localizedRoute } from "@/lib/localizedRoutes";
import { LanguageSwitcher } from "@/app/components/LanguageSwitcher";

// `gated: true` = la página ya maneja su propio candado para plan Free (ver
// PlanGate en cada page.tsx) — acá solo se refleja visualmente en el nav, nunca
// se decide acceso (mismo principio que docs/08-modelo-suscripciones.md §8.4).

// Secciones que no se le muestran a ningún cliente, ni Free ni Prime. No es un
// candado de plan: un candado invita a pagar por algo que existe, y esto todavía
// no se ofrece. Por eso se filtra el ítem en vez de marcarlo `minPlan:
// "premium"` — el usuario no debería enterarse de que la sección está ahí.
// El nav no decide acceso: la página también corta por su cuenta (notFound).
function getNavItems(locale: AppLocale) {
  return locale === "en"
    ? [
        { href: localizedRoute("projects", locale), label: "Future projects", icon: Activity, minPlan: "premium" },
        { href: localizedRoute("operations", locale), label: "Projects in operation", icon: ChartNoAxesCombined, minPlan: "free" },
        { href: localizedRoute("owners", locale), label: "Owners", icon: Network, minPlan: "premium" },
        { href: localizedRoute("obsx", locale), label: "ObsX", icon: Share2, minPlan: "premium" },
        { href: localizedRoute("tracking", locale), label: "Tracking", icon: Eye, minPlan: "premium" },
        // Va después de las fuentes de proyectos reales a propósito: PELP es
        // modelamiento de expansión, no un pipeline de proyectos.
        { href: "/crm", label: "CRM", icon: ContactRound, minPlan: "premium" },
        { href: localizedRoute("services", locale), label: "Additional services", icon: ClipboardList, minPlan: "free" },
      ]
    : [
        { href: "/proyectos", label: "Proyectos Futuros", icon: Activity, minPlan: "premium" },
        { href: "/operacion", label: "Proyectos en Operación", icon: ChartNoAxesCombined, minPlan: "free" },
        { href: "/propietarios", label: "Propietarios", icon: Network, minPlan: "premium" },
        { href: "/obsx", label: "ObsX", icon: Share2, minPlan: "premium" },
        { href: "/seguimiento", label: "Seguimiento", icon: Eye, minPlan: "premium" },
        { href: "/crm", label: "CRM", icon: ContactRound, minPlan: "premium" },
        { href: localizedRoute("services", locale), label: "Servicios adicionales", icon: ClipboardList, minPlan: "free" },
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
  const isFree = !isAdmin && planCode !== "premium";
  const baseNavItems = getNavItems(locale);
  const navItems = isAdmin ? [...baseNavItems, { href: "/admin", label: "Admin", icon: ShieldCheck, minPlan: "free" }] : baseNavItems;

  return (
    // Nav oscuro: el mismo #041415 de las cabeceras de sección, para que el
    // borde izquierdo y el header se lean como un solo marco.
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-white/10 bg-[#041415]/95 backdrop-blur-xl md:flex print:hidden">
      <Link href="/" className="flex flex-col items-center px-3 pt-6 pb-5 md:items-start md:px-5">
        {/* El logo va en su versión turquesa: el de uso normal lleva el texto en
            gris oscuro y desaparecería sobre el fondo negro. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/tl-logo-oscuro.png" alt="Transition LATAM" className="hidden h-9 w-auto md:block" />
        <span className="bg-brand-primary flex h-8 w-8 items-center justify-center rounded-md text-sm font-semibold text-[#052020] md:hidden">
          T
        </span>
        <span className="mt-3 hidden items-center gap-2 md:flex" aria-label={locale === "en" ? "TOS active" : "TOS activo"}>
          <span className="relative h-1.5 w-10 overflow-hidden rounded-full bg-white/12" aria-hidden>
            <span className="system-activity-scan-a absolute inset-y-0 -left-full w-full" />
            <span className="system-activity-scan-b absolute inset-y-0 -left-full w-full" />
          </span>
          <span className="text-[10px] font-semibold text-white/70">{locale === "en" ? "TOS active" : "TOS activo"}</span>
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
          className="h-10 w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 text-sm font-medium text-white outline-none transition focus:border-brand-primary"
        >
          <option value="cl" className="text-neutral-900">
            🇨🇱 Chile
          </option>
        </select>
        <div className="mt-3 flex justify-end">
          <LanguageSwitcher locale={locale} tone="dark" />
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2 py-4 md:px-3">
        {navItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          const locked = !isAdmin && item.minPlan === "premium" && planCode !== "premium";
          const isAdditionalService = item.href === localizedRoute("services", locale);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={locked ? `${item.label} — ${locale === "en" ? "available on a higher plan" : "disponible en un plan superior"}` : undefined}
              className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isAdditionalService
                  ? `mt-3 border border-white/12 bg-white/[0.07] font-semibold text-[#65e2d3] hover:bg-white/12 ${active ? "ring-2 ring-brand-primary/35" : ""}`
                : active
                  ? "bg-white/10 font-semibold text-white"
                  : locked
                    ? "text-white/45 hover:bg-white/5 hover:text-white"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
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
            href={localizedRoute("plans", locale)}
            className="block rounded-xl border border-white/12 bg-white/[0.04] p-3 transition hover:border-brand-primary/50 hover:bg-white/[0.08]"
          >
            <div className="relative flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-white/70">Plan Free</p>
              {remainingTrialDays !== null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary px-2 py-1 text-[9px] font-bold text-[#052020]">
                  <CalendarDays size={10} />
                  {remainingTrialDays > 1
                      ? `${remainingTrialDays} ${locale === "en" ? "days" : "días"}`
                    : remainingTrialDays === 1
                      ? locale === "en" ? "1 day" : "1 día"
                      : locale === "en" ? "Ended" : "Finalizado"}
                </span>
              )}
            </div>
            <p className="relative mt-2 text-xs font-semibold text-white">
              {remainingTrialDays === 0
                ? locale === "en" ? "Your Free period ended" : "Su periodo Free terminó"
                : locale === "en" ? "Unlock commercial intelligence" : "Desbloquee inteligencia comercial"}
            </p>
            {remainingTrialDays !== null && remainingTrialDays > 0 && (
              <p className="relative mt-1 text-[10px] font-medium text-white/65">
                {locale === "en" ? `${remainingTrialDays} days of access left` : `Quedan ${remainingTrialDays} ${remainingTrialDays === 1 ? "día" : "días"} de acceso`}
              </p>
            )}
            <p className="mt-1 text-[10px] leading-4 text-[#65e2d3]">{locale === "en" ? "Compare plans" : "Comparar planes"} →</p>
          </Link>
        </div>
      )}

      {userProfile && (
        <div className="border-t border-white/10 px-2 py-2 md:px-3">
          <Link
            href="/perfil"
            className="flex items-center gap-3 rounded-md px-1 py-2 text-sm transition-colors hover:bg-white/5"
          >
            {userProfile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userProfile.avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="bg-brand-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-[#052020]">
                {(userProfile.fullName ?? userProfile.email).charAt(0).toUpperCase()}
              </span>
            )}
            <span className="hidden min-w-0 flex-1 md:block">
              <span className="block truncate font-medium text-white">
                {userProfile.fullName ?? userProfile.email}
              </span>
              <span className="block truncate text-xs text-white/50">{locale === "en" ? "View profile" : "Ver perfil"}</span>
            </span>
          </Link>
        </div>
      )}

      <div className="border-t border-white/10 px-2 py-2 md:px-3">
        {isAdmin || userProfile ? (
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-white/60 transition-colors hover:text-white"
            >
              <LogOut size={17} strokeWidth={1.75} className="shrink-0" />
              <span className="hidden md:inline">{locale === "en" ? "Sign out" : "Cerrar sesión"}</span>
            </button>
          </form>
        ) : (
          <Link
            href="/ingresar"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-white/60 transition-colors hover:text-white"
          >
            <LogIn size={17} strokeWidth={1.75} className="shrink-0" />
            <span className="hidden md:inline">{locale === "en" ? "Sign in" : "Ingresar"}</span>
          </Link>
        )}
      </div>

    </aside>
  );
}
