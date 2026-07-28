"use client";

import { useActionState } from "react";
import { ingresar, type IngresarState } from "./actions";
import type { AppLocale } from "@/lib/i18n";

const initialState: IngresarState = {};

export function IngresarForm({ locale = "es" }: { locale?: AppLocale }) {
  const [state, formAction, pending] = useActionState(ingresar, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {locale === "en" ? "Email" : "Correo"}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoFocus
          required
          placeholder="nombre@empresa.com"
          className="w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 dark:border-neutral-700"
        />
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
          placeholder={locale === "en" ? "Your password" : "Tu contraseña"}
          className="w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 dark:border-neutral-700"
        />
      </div>
      {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-ink disabled:opacity-50"
      >
        {pending ? (locale === "en" ? "Signing in..." : "Ingresando...") : (locale === "en" ? "Sign in" : "Ingresar")}
      </button>
    </form>
  );
}
