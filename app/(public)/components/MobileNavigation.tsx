"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  ChartNoAxesCombined,
  ContactRound,
  Home,
  LockKeyhole,
  LogIn,
  LogOut,
  Menu,
  Network,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { logout } from "@/app/login/actions";
import type { CurrentUserProfile } from "@/lib/data-access/userProfile";
import type { AppLocale } from "@/lib/i18n";

const primaryItems = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/mercado", label: "Matriz", icon: ChartNoAxesCombined },
  { href: "/proyectos-esperados", label: "Proyectos", icon: Activity },
  { href: "/analisis-dinamico", label: "Análisis", icon: BarChart3, minPlan: "lite" },
] as const;

const secondaryItems = [
  { href: "/mapa-stakeholder", label: "Empresas y relaciones", icon: Network, minPlan: "premium" },
  { href: "/crm", label: "CRM", icon: ContactRound, minPlan: "premium" },
  { href: "/alertas", label: "Seguimiento", icon: Bell, minPlan: "lite" },
] as const;

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
  const planCode = userProfile?.planCode ?? "free";
  const isLocked = (minPlan?: string) =>
    !isAdmin && (minPlan === "premium" ? planCode !== "premium" : minPlan === "lite" ? !["lite", "premium"].includes(planCode) : false);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button aria-label="Cerrar menú" className="absolute inset-0 bg-neutral-950/45 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <section className="absolute right-0 bottom-0 left-0 max-h-[82dvh] overflow-y-auto rounded-t-3xl bg-white px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl dark:bg-neutral-950">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-neutral-900 dark:text-white">Transition LATAM</p>
                <p className="text-xs text-neutral-500">{locale === "en" ? "Project intelligence" : "Inteligencia de proyectos"}</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Cerrar menú" className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-900">
                <X size={20} />
              </button>
            </div>

            <nav className="grid gap-2">
              {secondaryItems.map((item) => {
                const Icon = item.icon;
                const locked = isLocked(item.minPlan);
                return (
                  <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="flex min-h-14 items-center gap-3 rounded-2xl border border-neutral-100 px-4 py-3 dark:border-neutral-800">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-surface text-brand-deep dark:text-brand-primary"><Icon size={20} /></span>
                    <span className="flex-1 font-medium">{item.label}</span>
                    {locked && <LockKeyhole size={16} className="text-neutral-400" />}
                  </Link>
                );
              })}
              {isAdmin && (
                <Link href="/admin" onClick={() => setOpen(false)} className="flex min-h-14 items-center gap-3 rounded-2xl border border-neutral-100 px-4 py-3 dark:border-neutral-800">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-surface text-brand-deep dark:text-brand-primary"><ShieldCheck size={20} /></span>
                  <span className="flex-1 font-medium">Admin</span>
                </Link>
              )}
            </nav>

            <div className="mt-4 border-t border-neutral-100 pt-4 dark:border-neutral-800">
              {userProfile && (
                <Link href="/perfil" onClick={() => setOpen(false)} className="mb-2 flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <UserRound size={20} />
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{userProfile.fullName ?? userProfile.email}</span><span className="block text-xs text-neutral-500">Ver perfil · Plan {planCode}</span></span>
                </Link>
              )}
              {isAdmin ? (
                <form action={logout}><button className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-neutral-600 dark:text-neutral-300"><LogOut size={20} /> Cerrar sesión</button></form>
              ) : (
                <Link href="/login" onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-neutral-600 dark:text-neutral-300"><LogIn size={20} /> Ingresar</Link>
              )}
            </div>
          </section>
        </div>
      )}

      <nav className="fixed right-0 bottom-0 left-0 z-40 grid grid-cols-5 border-t border-neutral-200 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(0,0,0,.08)] backdrop-blur-xl md:hidden dark:border-neutral-800 dark:bg-neutral-950/95">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const locked = isLocked("minPlan" in item ? item.minPlan : undefined);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium ${active ? "text-brand-deep dark:text-brand-primary" : "text-neutral-500"}`}>
              {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-brand-primary" />}
              <span className="relative"><Icon size={21} strokeWidth={active ? 2.2 : 1.8} />{locked && <LockKeyhole size={10} className="absolute -top-1 -right-2 rounded-full bg-white dark:bg-neutral-950" />}</span>
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
        <button onClick={() => setOpen(true)} aria-expanded={open} className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium ${open ? "text-brand-deep dark:text-brand-primary" : "text-neutral-500"}`}>
          <Menu size={21} /><span>Más</span>
        </button>
      </nav>
    </>
  );
}
