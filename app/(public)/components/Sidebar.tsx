"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bell, ChartNoAxesCombined, ContactRound, Network, LogIn, LogOut, ShieldCheck } from "lucide-react";
import { LastSyncIndicator } from "./LastSyncIndicator";
import { logout } from "@/app/login/actions";
import type { CurrentUserProfile } from "@/lib/data-access/userProfile";

const NAV_ITEMS = [
  { href: "/mercado", label: "Infraestructura", icon: ChartNoAxesCombined },
  { href: "/proyectos-esperados", label: "Proyectos futuros", icon: Activity },
  { href: "/mapa-stakeholder", label: "Stakeholders", icon: Network },
  { href: "/crm", label: "CRM", icon: ContactRound },
];

export function Sidebar({
  lastSync,
  isAdmin,
  userProfile,
}: {
  lastSync: string | null;
  isAdmin: boolean;
  userProfile: CurrentUserProfile | null;
}) {
  const pathname = usePathname();
  const navItems = isAdmin
    ? [
        ...NAV_ITEMS,
        { href: "/alertas", label: "Seguimiento", icon: Bell },
        { href: "/admin", label: "Admin", icon: ShieldCheck },
      ]
    : NAV_ITEMS;

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-16 flex-col border-r border-neutral-200 bg-white md:w-64 dark:border-neutral-800 dark:bg-neutral-950 print:hidden">
      <Link href="/" className="flex items-center justify-center px-3 pt-6 pb-5 md:justify-start md:px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/tl-logo.png" alt="Transition LATAM" className="hidden h-9 w-auto md:block" />
        <span className="bg-brand-primary flex h-8 w-8 items-center justify-center rounded-md text-sm font-semibold text-white md:hidden">
          T
        </span>
      </Link>

      <div className="hidden px-5 pb-3 md:block">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-neutral-400 uppercase dark:text-neutral-500">
          Inteligencia de proyectos
        </p>
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
          🇨🇱 Chile
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2 py-4 md:px-3">
        {navItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "font-medium text-neutral-900 dark:text-neutral-50"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
              }`}
            >
              {active && <span className="bg-brand-primary absolute inset-y-1 left-0 w-0.5 rounded-full" aria-hidden />}
              <Icon size={17} strokeWidth={1.75} className="shrink-0" />
              <span className="hidden flex-1 truncate md:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

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
              <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">Ver perfil</span>
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
              <span className="hidden md:inline">Cerrar sesión</span>
            </button>
          </form>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            <LogIn size={17} strokeWidth={1.75} className="shrink-0" />
            <span className="hidden md:inline">Ingresar</span>
          </Link>
        )}
      </div>

      <div className="hidden border-t border-neutral-100 px-5 py-4 md:block dark:border-neutral-900">
        <LastSyncIndicator isoTimestamp={lastSync} />
      </div>
    </aside>
  );
}
