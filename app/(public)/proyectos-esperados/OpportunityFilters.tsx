"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, X } from "lucide-react";
import { PHASE_GROUPS, PHASE_GROUP_LABELS } from "@/lib/shared/projectPhaseDurations";
import type { AppLocale } from "@/lib/i18n";
import { TECH_CHIPS } from "../components/techChips";

/**
 * La barra de filtros del explorador, en una sola fila.
 *
 * Es propia de esta página y no reemplaza a SearchBar/TechSelectFilter, que
 * siguen sirviendo a Operación con otra disposición: acá el requisito es que
 * los tres controles entren en una línea y ocupen poco alto, y el buscador va
 * angosto a propósito porque el nombre del proyecto se escribe corto.
 *
 * La selección múltiple de tecnología no es nueva por detrás: `tech` ya viajaba
 * como lista separada por comas y `parseChipKeys` ya la leía así (lo usa la
 * barra de chips de Operación). Lo único que faltaba era una UI que dejara
 * marcar más de una.
 */

const TECH_EN: Record<string, string> = {
  eolico: "Wind",
  hidro: "Hydropower",
  termica: "Thermal",
  hibridos: "Hybrid",
  transmision: "Transmission and distribution",
};

const ETAPA_EN: Record<string, string> = {
  temprano: "Early development",
  ingenieria: "Engineering",
  compras: "Procurement",
  construccion: "Construction",
  comisionamiento: "Commissioning / Testing",
};

/** Alto común de los tres controles: sin esto la fila se ve escalonada. */
const CONTROL = "h-10 rounded-xl border border-neutral-300 bg-transparent text-sm dark:border-neutral-700";

export function OpportunityFilters({
  basePath,
  locale = "es",
  search,
  selectedKeys,
  excludeKeys,
  etapa,
  showEtapa,
  suggestions = [],
}: {
  basePath: string;
  locale?: AppLocale;
  search: string | undefined;
  selectedKeys: string[];
  excludeKeys?: string[];
  etapa: string | undefined;
  /** El histórico no tiene etapa estimada: ahí el control no se muestra. */
  showEtapa: boolean;
  suggestions?: string[];
}) {
  const en = locale === "en";
  const router = useRouter();
  const searchParams = useSearchParams();
  const suggestionListId = useId();
  const [abierto, setAbierto] = useState(false);
  const desplegableRef = useRef<HTMLDivElement>(null);

  const chips = excludeKeys ? TECH_CHIPS.filter((chip) => !excludeKeys.includes(chip.key)) : TECH_CHIPS;
  const etiquetaTech = (key: string, label: string) => (en ? (TECH_EN[key] ?? label) : label);

  /** Reescribe la URL cambiando solo las claves indicadas; el resto de los filtros sobrevive. */
  function navegar(cambios: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) params.set(clave, valor);
      else params.delete(clave);
    }
    params.delete("page");
    const query = params.toString();
    router.replace(query ? `${basePath}?${query}` : basePath, { scroll: false });
  }

  function alBuscar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const valor = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    navegar({ q: valor || undefined });
  }

  function alternarTecnologia(key: string) {
    const siguiente = selectedKeys.includes(key) ? selectedKeys.filter((k) => k !== key) : [...selectedKeys, key];
    navegar({ tech: siguiente.length ? siguiente.join(",") : undefined });
  }

  // Cerrar al hacer clic fuera o con Escape: un desplegable que se queda abierto
  // tapa la tabla de resultados que el usuario acaba de filtrar.
  useEffect(() => {
    if (!abierto) return;
    const alClic = (event: MouseEvent) => {
      if (!desplegableRef.current?.contains(event.target as Node)) setAbierto(false);
    };
    const alTeclear = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", alClic);
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("mousedown", alClic);
      document.removeEventListener("keydown", alTeclear);
    };
  }, [abierto]);

  const seleccionadas = chips.filter((chip) => selectedKeys.includes(chip.key));
  const resumenTech =
    seleccionadas.length === 0
      ? en
        ? "Select technologies"
        : "Seleccionar tecnologías"
      : seleccionadas.map((chip) => etiquetaTech(chip.key, chip.label)).join(", ");

  return (
    <div className="flex flex-wrap items-end gap-3">
      <form onSubmit={alBuscar} action={basePath} className="flex items-end gap-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            {en ? "Search by project name" : "Buscar por nombre de proyecto"}
          </span>
          <input
            type="text"
            name="q"
            defaultValue={search ?? ""}
            placeholder={en ? "Search by name..." : "Buscar por nombre..."}
            list={suggestions.length ? suggestionListId : undefined}
            autoComplete="off"
            // Angosto a propósito: la mitad del ancho anterior, que se comía la
            // fila entera y empujaba los desplegables a la línea de abajo.
            className={`${CONTROL} w-52 px-3 sm:w-56`}
          />
        </label>
        {suggestions.length > 0 && (
          <datalist id={suggestionListId}>
            {suggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        )}
        <button
          type="submit"
          className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {en ? "Search" : "Buscar"}
        </button>
      </form>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-neutral-600 dark:text-neutral-400">{en ? "Technology" : "Tecnología"}</span>
        <div ref={desplegableRef} className="relative">
          <button
            type="button"
            onClick={() => setAbierto((valor) => !valor)}
            aria-expanded={abierto}
            aria-haspopup="listbox"
            className={`${CONTROL} flex w-60 items-center justify-between gap-2 px-3 text-left`}
          >
            <span className={`truncate ${seleccionadas.length ? "" : "text-neutral-500 dark:text-neutral-400"}`}>
              {resumenTech}
            </span>
            <ChevronDown size={16} className="shrink-0 text-neutral-500" />
          </button>

          {abierto && (
            <div
              role="listbox"
              aria-multiselectable
              className="absolute left-0 top-[calc(100%+4px)] z-30 w-64 overflow-hidden rounded-xl border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-950"
            >
              {chips.map((chip) => {
                const marcada = selectedKeys.includes(chip.key);
                return (
                  <button
                    key={chip.key}
                    type="button"
                    role="option"
                    aria-selected={marcada}
                    onClick={() => alternarTecnologia(chip.key)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-900"
                  >
                    <span
                      aria-hidden
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        marcada
                          ? "border-brand-primary bg-brand-primary text-[#052020]"
                          : "border-neutral-300 dark:border-neutral-600"
                      }`}
                    >
                      {marcada && <Check size={12} strokeWidth={3} />}
                    </span>
                    <span className="truncate">{etiquetaTech(chip.key, chip.label)}</span>
                  </button>
                );
              })}
              {seleccionadas.length > 0 && (
                <button
                  type="button"
                  onClick={() => navegar({ tech: undefined })}
                  className="mt-1 flex w-full items-center gap-1.5 border-t border-neutral-100 px-2.5 py-2 text-left text-xs text-neutral-500 hover:text-neutral-800 dark:border-neutral-800 dark:hover:text-neutral-200"
                >
                  <X size={12} /> {en ? "Clear technologies" : "Quitar tecnologías"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showEtapa && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-neutral-600 dark:text-neutral-400">{en ? "Estimated stage" : "Etapa estimada"}</span>
          <select
            value={etapa ?? ""}
            onChange={(event) => navegar({ etapa: event.target.value || undefined })}
            className={`${CONTROL} w-56 px-3`}
          >
            <option value="">{en ? "All stages" : "Todas las etapas"}</option>
            {PHASE_GROUPS.map((grupo) => (
              <option key={grupo} value={grupo}>
                {en ? ETAPA_EN[grupo] : PHASE_GROUP_LABELS[grupo]}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
