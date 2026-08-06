import type { AppLocale } from "./i18n";

const LOCALIZED_ROUTES = {
  projects: { es: "/proyectos", en: "/projects" },
  operations: { es: "/operacion", en: "/operations" },
  owners: { es: "/propietarios", en: "/owners" },
  tracking: { es: "/seguimiento", en: "/tracking" },
  analysis: { es: "/analisis-dinamico", en: "/dynamic-analysis" },
  services: { es: "/servicios", en: "/services" },
  plans: { es: "/planes", en: "/plans" },
  subscribe: { es: "/contratar-prime", en: "/subscribe-prime" },
} as const;

export function localizedRoute(key: keyof typeof LOCALIZED_ROUTES, locale: AppLocale): string {
  return LOCALIZED_ROUTES[key][locale];
}

export function equivalentLocalePath(pathname: string, locale: AppLocale): string {
  for (const routes of Object.values(LOCALIZED_ROUTES)) {
    for (const source of Object.values(routes)) {
      if (pathname === source || pathname.startsWith(`${source}/`)) {
        return `${routes[locale]}${pathname.slice(source.length)}`;
      }
    }
  }
  return pathname;
}
