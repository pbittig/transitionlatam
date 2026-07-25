import Link from "next/link";

/** Buscador de texto — preserva el resto de filtros activos (chips, estado, tab) vía inputs ocultos. */
export function SearchBar({
  basePath,
  value,
  otherParams,
  placeholder = "Buscar por nombre...",
  children,
}: {
  basePath: string;
  value: string | undefined;
  otherParams: Record<string, string | undefined>;
  placeholder?: string;
  /** Controles extra (ej. un <select> de estado) que se envían junto con la búsqueda, en el mismo form. */
  children?: React.ReactNode;
}) {
  return (
    <form className="flex flex-wrap items-center gap-2" action={basePath}>
      {Object.entries(otherParams).map(
        ([key, val]) => val && <input key={key} type="hidden" name={key} value={val} />,
      )}
      <input
        type="text"
        name="q"
        defaultValue={value ?? ""}
        placeholder={placeholder}
        className="min-w-[240px] flex-1 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
      />
      {children}
      <button
        type="submit"
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        Buscar
      </button>
      {value && (
        <Link
          href={(() => {
            const qs = new URLSearchParams();
            for (const [k, v] of Object.entries(otherParams)) if (v) qs.set(k, v);
            const query = qs.toString();
            return query ? `${basePath}?${query}` : basePath;
          })()}
          className="text-sm text-neutral-500 hover:underline dark:text-neutral-400"
        >
          Limpiar búsqueda
        </Link>
      )}
    </form>
  );
}
