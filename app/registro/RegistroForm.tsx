"use client";

import { useActionState } from "react";
import { registrarse, type RegistroState } from "./actions";

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

export function RegistroForm() {
  const [state, formAction, pending] = useActionState(registrarse, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Nombre completo
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          autoFocus
          required
          className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        />
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Correo corporativo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        />
      </div>
      <div>
        <label htmlFor="companyName" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Empresa
        </label>
        <input
          id="companyName"
          name="companyName"
          type="text"
          required
          className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        />
      </div>
      <div>
        <label htmlFor="userType" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          ¿Qué rol te describe mejor?
        </label>
        <select
          id="userType"
          name="userType"
          defaultValue="developer"
          className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
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
          País
        </label>
        <select
          id="country"
          name="country"
          defaultValue="Chile"
          className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
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
          Clave
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        />
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">Mínimo 8 caracteres.</p>
      </div>
      {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {pending ? "Creando cuenta..." : "Crear cuenta gratis (14 días)"}
      </button>
    </form>
  );
}
