"use client";

import { useActionState } from "react";
import { registrarse, type RegistroState } from "./actions";
import type { AppLocale } from "@/lib/i18n";

const initialState: RegistroState = {};

const USER_TYPE_OPTIONS = [
  { value: "developer", label: "Desarrollador" },
  { value: "investor", label: "Financista / Inversionista" },
  { value: "epc", label: "EPC / Proveedor" },
  { value: "other", label: "Otro" },
];

const COUNTRY_OPTIONS = [
  "Chile",
  "Argentina",
  "Perú",
  "Colombia",
  "México",
  "Brasil",
  "Uruguay",
  "Paraguay",
  "Bolivia",
  "Ecuador",
  "Venezuela",
  "Panamá",
  "Costa Rica",
  "España",
  "Estados Unidos",
  "Otro",
];

export function RegistroForm({ locale = "es" }: { locale?: AppLocale }) {
  const [state, formAction, pending] = useActionState(registrarse, initialState);

  if (state?.message) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-brand-primary/30 bg-brand-primary/5 p-4 text-sm text-neutral-800 dark:text-neutral-200">
        <p>{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {locale === "en" ? "Full name" : "Nombre completo"}
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          autoFocus
          required
          placeholder="Nombre y apellido"
          className="w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 dark:border-neutral-700"
        />
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {locale === "en" ? "Business email" : "Correo corporativo"}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="nombre@empresa.com"
          className="w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 dark:border-neutral-700"
        />
      </div>
      <div>
        <label htmlFor="companyName" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {locale === "en" ? "Company" : "Empresa"}
        </label>
        <input
          id="companyName"
          name="companyName"
          type="text"
          required
          placeholder="Nombre de tu empresa"
          className="w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 dark:border-neutral-700"
        />
      </div>
      <div>
        <label htmlFor="jobTitle" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {locale === "en" ? "Job title" : "Cargo"}
        </label>
        <input
          id="jobTitle"
          name="jobTitle"
          type="text"
          required
          placeholder={locale === "en" ? "e.g. Business Development Director" : "Ej. Director de Desarrollo de Negocios"}
          className="w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 dark:border-neutral-700"
        />
      </div>
      <div>
        <label htmlFor="mobilePhone" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {locale === "en" ? "Mobile phone" : "Teléfono de contacto (móvil)"}
        </label>
        <input
          id="mobilePhone"
          name="mobilePhone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder={locale === "en" ? "+56 9 1234 5678" : "+56 9 1234 5678"}
          className="w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2.5 text-base outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 sm:text-sm dark:border-neutral-700"
        />
      </div>
      <div>
        <label htmlFor="userType" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {locale === "en" ? "Which role best describes you?" : "¿Qué rol te describe mejor?"}
        </label>
        <select
          id="userType"
          name="userType"
          defaultValue="developer"
          className="w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-brand-primary dark:border-neutral-700"
        >
          {USER_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="country" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {locale === "en" ? "Country" : "País"}
        </label>
        <select
          id="country"
          name="country"
          defaultValue="Chile"
          className="w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-brand-primary dark:border-neutral-700"
        >
          {COUNTRY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {locale === "en" ? "Password" : "Clave"}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="Mínimo 8 caracteres"
          className="w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 dark:border-neutral-700"
        />
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">{locale === "en" ? "At least 8 characters." : "Mínimo 8 caracteres."}</p>
      </div>
      {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-[#333333] shadow-sm transition hover:brightness-95 disabled:opacity-50"
      >
        {pending ? (locale === "en" ? "Creating account..." : "Creando cuenta...") : (locale === "en" ? "Create free account (14 days)" : "Crear cuenta gratis (14 días)")}
      </button>
    </form>
  );
}
