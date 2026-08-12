import type { AppLocale } from "@/lib/i18n";

/**
 * Aviso obligatorio en toda vista de PELP.
 *
 * Estos registros son candidatos de un modelo de optimización, no proyectos.
 * Un activo llamado "solar PV_Antofagasta_39" con 20 MW en Sierra Gorda podría
 * leerse como un proyecto real en esa comuna, y no lo es. La regla del proyecto
 * de nunca presentar una estimación como hecho verificado
 * (docs/02-prd.md §2.3) obliga a decirlo de forma explícita, no en letra chica.
 */
export function ModelledDisclaimer({ locale }: { locale: AppLocale }) {
  const en = locale === "en";
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/25 dark:bg-amber-500/10">
      <p className="text-xs font-semibold text-amber-900 dark:text-amber-300">
        {en ? "PELP — MODELLED EXPANSION" : "PELP — EXPANSIÓN MODELADA"}
      </p>
      <p className="mt-1 text-xs leading-5 text-amber-900/90 dark:text-amber-200/90">
        {en
          ? "These records are expansion candidates identified by the long-term planning model. They do not necessarily mean a project currently exists in development, construction or permitting. Asset names are synthetic model identifiers, not companies or plants."
          : "Este registro corresponde a una expansión/candidato identificado por el modelo de planificación de largo plazo de PELP. No implica necesariamente que exista actualmente un proyecto en desarrollo, construcción o tramitación. Los nombres de activo son identificadores sintéticos del modelo, no sociedades ni centrales."}
      </p>
    </div>
  );
}
