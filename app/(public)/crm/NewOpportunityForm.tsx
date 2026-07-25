"use client";

import { useActionState } from "react";
import { createOpportunity, type CreateOpportunityState } from "./actions";

const initialState: CreateOpportunityState = {};

const OPPORTUNITY_TYPES = [
  { value: "investment", label: "Inversión" },
  { value: "epc", label: "EPC" },
  { value: "technology_sale", label: "Venta de tecnología" },
  { value: "partnership", label: "Alianza" },
  { value: "market_entry", label: "Entrada a mercado" },
];

export function NewOpportunityForm() {
  const [state, formAction, pending] = useActionState(createOpportunity, initialState);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="description" className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Descripción — empresa, contacto, contexto
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={2}
          placeholder="Ej: Engie — interesados en financiar Parque Eólico Los Andes, contacto María Soto (Gerente de Desarrollo)."
          className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        />
      </div>
      <div>
        <label htmlFor="opportunityType" className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Tipo de oportunidad
        </label>
        <select
          id="opportunityType"
          name="opportunityType"
          defaultValue=""
          className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        >
          <option value="">Sin clasificar</option>
          {OPPORTUNITY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="ownerName" className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Responsable en ONIX
        </label>
        <input
          id="ownerName"
          name="ownerName"
          type="text"
          className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        />
      </div>
      <div>
        <label htmlFor="nextStep" className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Próxima acción
        </label>
        <input
          id="nextStep"
          name="nextStep"
          type="text"
          placeholder="Ej: Agendar llamada"
          className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        />
      </div>
      <div>
        <label htmlFor="nextStepAt" className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Fecha
        </label>
        <input
          id="nextStepAt"
          name="nextStepAt"
          type="date"
          className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        />
      </div>
      {state?.error && <p className="text-sm text-red-600 sm:col-span-2 dark:text-red-400">{state.error}</p>}
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-brand-primary rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Creando..." : "Crear oportunidad"}
        </button>
      </div>
    </form>
  );
}
