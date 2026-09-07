import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Envoltorio común de las páginas legales (Términos, Privacidad, Cookies).
 *
 * Fuera de `(public)`, igual que /registro e /ingresar: se debe poder leer
 * antes de tener sesión — es literalmente lo que se acepta al crear la cuenta.
 */
export function LegalPageShell({
  title,
  updatedAt,
  children,
}: {
  title: string;
  /** Fecha de la versión vigente, en el mismo texto que `terms_version` (actions.ts). */
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <Link
        href="/registro"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-brand-deep dark:hover:text-brand-primary"
      >
        <ArrowLeft size={13} /> Volver
      </Link>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">{title}</h1>
      <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">Última actualización: {updatedAt}</p>
      <div className="prose-legal mt-8 flex flex-col gap-5 text-sm leading-6 text-neutral-700 dark:text-neutral-300 [&_a]:font-medium [&_a]:text-brand-deep [&_a]:underline dark:[&_a]:text-brand-primary [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-neutral-950 dark:[&_h2]:text-white [&_strong]:font-semibold [&_strong]:text-neutral-900 dark:[&_strong]:text-neutral-100 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_td]:border [&_td]:border-neutral-200 [&_td]:px-2 [&_td]:py-1.5 dark:[&_td]:border-neutral-800 [&_th]:border [&_th]:border-neutral-200 [&_th]:bg-neutral-50 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left dark:[&_th]:border-neutral-800 dark:[&_th]:bg-neutral-900">
        {children}
      </div>
    </div>
  );
}
