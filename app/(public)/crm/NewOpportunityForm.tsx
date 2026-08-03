"use client";

import { useActionState, useState } from "react";
import type { OpportunityProjectOption } from "@/lib/data-access/opportunities";
import { createOpportunity, type CreateOpportunityState } from "./actions";
import type { AppLocale } from "@/lib/i18n";

const initialState: CreateOpportunityState = {};

const OPPORTUNITY_TYPES = [
  { value: "investment", label: "Inversión" },
  { value: "epc", label: "EPC / Construcción" },
  { value: "technology_sale", label: "Equipos y tecnología" },
  { value: "partnership", label: "Alianza o socio" },
  { value: "market_entry", label: "Entrada a mercado" },
  { value: "development", label: "Desarrollo de proyecto" },
  { value: "advisory", label: "Servicios profesionales" },
];

export function NewOpportunityForm({ projects, locale = "es" }: { projects: OpportunityProjectOption[]; locale?: AppLocale }) {
  const [state, formAction, pending] = useActionState(createOpportunity, initialState);
  const [projectId, setProjectId] = useState("");
  const [personId, setPersonId] = useState("");
  const selectedProject = projects.find((project) => project.id === projectId) ?? null;

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="projectId" className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          {locale === "en" ? "Related project" : "Proyecto relacionado"}
        </label>
        <select
          id="projectId"
          name="projectId"
          value={projectId}
          onChange={(event) => {
            setProjectId(event.target.value);
            setPersonId("");
          }}
          required
          className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        >
          <option value="">{locale === "en" ? "Select a verified project" : "Selecciona un proyecto verificado"}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}{project.company ? ` — ${project.company.name}` : ""}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-neutral-400">Sólo se muestran proyectos revisados. La empresa y los contactos se obtienen desde su ficha.</p>
      </div>
      <div>
        <label htmlFor="companyName" className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Empresa titular
        </label>
        <input
          id="companyName"
          value={selectedProject?.company?.name ?? ""}
          readOnly
          placeholder={projectId ? "Empresa pendiente de identificar" : "Selecciona primero un proyecto"}
          className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
        />
      </div>
      <div>
        <label htmlFor="personId" className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Contacto relacionado
        </label>
        <select
          id="personId"
          name="personId"
          value={personId}
          onChange={(event) => setPersonId(event.target.value)}
          disabled={!selectedProject}
          className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm disabled:bg-neutral-50 disabled:text-neutral-400 dark:border-neutral-700 dark:disabled:bg-neutral-900"
        >
          <option value="">{selectedProject?.contacts.length ? "Seleccionar contacto (opcional)" : "Sin contactos relacionados disponibles"}</option>
          {selectedProject?.contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.name}{contact.role ? ` — ${contact.role}` : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="description" className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          {locale === "en" ? "Commercial context" : "Contexto comercial"}
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={3}
          placeholder="Ej: Proyecto próximo a construcción; existe una potencial necesidad de suministro BESS."
          className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        />
      </div>
      <div>
        <label htmlFor="opportunityType" className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          {locale === "en" ? "Opportunity type" : "Tipo de oportunidad"}
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
          {locale === "en" ? "Opportunity owner" : "Responsable de la oportunidad"}
        </label>
        <input
          id="ownerName"
          name="ownerName"
          type="text"
          placeholder="Nombre del responsable"
          className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        />
      </div>
      <div>
        <label htmlFor="nextStep" className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          {locale === "en" ? "Specific next step" : "Próximo paso concreto"}
        </label>
        <input
          id="nextStep"
          name="nextStep"
          type="text"
          placeholder="Ej: Identificar contacto de compras"
          className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        />
      </div>
      <div>
        <label htmlFor="nextStepAt" className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          {locale === "en" ? "Target date" : "Fecha compromiso"}
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
          {pending ? (locale === "en" ? "Saving..." : "Guardando...") : (locale === "en" ? "Save opportunity" : "Guardar oportunidad")}
        </button>
      </div>
    </form>
  );
}
