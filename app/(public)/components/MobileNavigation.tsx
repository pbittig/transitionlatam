"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Eye,
  ChartNoAxesCombined,
  ClipboardList,
  ContactRound,
  LockKeyhole,
  LogIn,
  LogOut,
  Menu,
  Network,
  Share2,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { logout } from "@/app/ingresar/actions";
import type { CurrentUserProfile } from "@/lib/data-access/userProfile";
import type { AppLocale } from "@/lib/i18n";
import { localizedRoute } from "@/lib/localizedRoutes";
import { LanguageSwitcher } from "@/app/components/LanguageSwitcher";

function getItems(locale: AppLocale) {
  const primaryItems = [
    { href: localizedRoute("projects", locale), label: locale === "en" ? "Future projects" : "Proyectos Futuros", icon: Activity, minPlan: "premium" },
    { href: localizedRoute("operations", locale), label: locale === "en" ? "Projects in operation" : "Proyectos en Operación", icon: ChartNoAxesCombined, minPlan: "free" },
    { href: localizedRoute("tracking", locale), label: locale === "en" ? "Tracking" : "Seguimiento", icon: Eye, minPlan: "premium" },
  ] as const;
  const secondaryItems = [
    { href: localizedRoute("analysis", locale), label: locale === "en" ? "Dynamic analysis" : "Análisis dinámico", icon: BarChart3, minPlan: "premium" },
    { href: localizedRoute("owners", locale), label: locale === "en" ? "Owners" : "Propietarios", icon: Network, minPlan: "premium" },
    { href: localizedRoute("obsx", locale), label: "ObsX", icon: Share2, minPlan: "premium" },
    { href: "/crm", label: "CRM", icon: ContactRound, minPlan: "premium" },
    { href: localizedRoute("services", locale), label: locale === "en" ? "Additional services" : "Servicios adicionales", icon: ClipboardList, minPlan: "free" },
  ] as const;
  return { primaryItems, secondaryItems };
}

export function MobileNavigation({
  isAdmin,
  userProfile,
  locale,
}: {
  isAdmin: boolean;
  userProfile: CurrentUserProfile | null;
  locale: AppLocale;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { primaryItems, secondaryItems } = getItems(locale);
  const planCode = userProfile?.planCode ?? "free";
  const isLocked = (minPlan?: string) => !isAdmin && minPlan === "premium" && planCode !== "premium";

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button aria-label="Cerrar menú" className="absolute inset-0 bg-neutral-950/45 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <section className="absolute right-0 bottom-0 left-0 max-h-[82dvh] overflow-y-auto rounded-t-3xl bg-[#041415] px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] text-white shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">Transition LATAM</p>
                <p className="text-xs text-white/55">{locale === "en" ? "Project intelligence" : "Inteligencia de proyectos"}</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Cerrar menú" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white">
                <X size={20} />
              </button>
            </div>
            <div className="mb-4 flex justify-end"><LanguageSwitcher locale={locale} tone="dark" /></div>

            <nav className="grid gap-2">
              {secondaryItems.map((item) => {
                const Icon = item.icon;
                const locked = isLocked(item.minPlan);
                const isAdditionalService = item.href === localizedRoute("services", locale);
                return (
                  <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 ${isAdditionalService ? "mt-2 border-white/15 bg-white/[0.07] font-semibold text-[#65e2d3]" : "border-white/10"}`}>
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${isAdditionalService ? "bg-brand-primary text-[#052020]" : "bg-white/10 text-white"}`}><Icon size={20} /></span>
                    <span className="flex-1 font-medium">{item.label}</span>
                    {locked && <LockKeyhole size={16} className="text-white/40" />}
                  </Link>
                );
              })}
              {isAdmin && (
                <Link href="/admin" onClick={() => setOpen(false)} className="flex min-h-14 items-center gap-3 rounded-2xl border border-white/10 px-4 py-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-brand-primary"><ShieldCheck size={20} /></span>
                  <span className="flex-1 font-medium">{locale === "en" ? "Admin" : "Admin"}</span>
                </Link>
              )}
            </nav>

            <div className="mt-4 border-t border-white/10 pt-4">
              {userProfile && (
                <Link href="/perfil" onClick={() => setOpen(false)} className="mb-2 flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/5">
                  <UserRound size={20} />
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{userProfile.fullName ?? userProfile.email}</span><span className="block text-xs text-white/50">{locale === "en" ? "View profile" : "Ver perfil"} · Plan {planCode === "free" ? "Free" : "Prime"}</span></span>
                </Link>
              )}
              {isAdmin || userProfile ? (
                <form action={logout}><button className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-white/70"><LogOut size={20} /> {locale === "en" ? "Sign out" : "Cerrar sesión"}</button></form>
              ) : (
                <Link href="/ingresar" onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-white/70"><LogIn size={20} /> {locale === "en" ? "Sign in" : "Ingresar"}</Link>
              )}
            </div>
          </section>
        </div>
      )}

      <nav className="fixed right-0 bottom-0 left-0 z-40 grid grid-cols-4 border-t border-white/10 bg-[#041415]/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(0,0,0,.35)] backdrop-blur-xl md:hidden">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          const locked = isLocked("minPlan" in item ? item.minPlan : undefined);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium ${active ? "text-brand-primary" : "text-white/55"}`}>
              {active && <span className="absolute top-0 h-0.5 w-7 rounded-full bg-brand-primary" />}
              <span className="relative"><Icon size={21} strokeWidth={active ? 2.2 : 1.8} />{locked && <LockKeyhole size={10} className="absolute -top-1 -right-2 rounded-full bg-[#041415]" />}</span>
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
        <button onClick={() => setOpen(true)} aria-expanded={open} className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium ${open ? "text-brand-primary" : "text-white/55"}`}>
          <Menu size={21} /><span>{locale === "en" ? "More" : "Más"}</span>
        </button>
      </nav>
    </>
  );
}
