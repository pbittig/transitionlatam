"use client";

import { useActionState } from "react";
import { restablecerClave, type RestablecerClaveState } from "./actions";
import type { AppLocale } from "@/lib/i18n";

const initialState: RestablecerClaveState = {};

export function RestablecerClaveForm({ locale = "es" }: { locale?: AppLocale }) {
  const [state, formAction, pending] = useActionState(restablecerClave, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {locale === "en" ? "New password" : "Clave nueva"}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoFocus
          required
          minLength={8}
          placeholder={locale === "en" ? "At least 8 characters" : "Mínimo 8 caracteres"}
          className="w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 dark:border-neutral-700"
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {locale === "en" ? "Confirm new password" : "Confirma la clave nueva"}
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          placeholder={locale === "en" ? "Repeat the password" : "Repite la clave"}
          className="w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 dark:border-neutral-700"
        />
      </div>
      {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-[#333333] shadow-sm transition hover:brightness-95 disabled:opacity-50"
      >
        {pending ? (locale === "en" ? "Saving..." : "Guardando...") : locale === "en" ? "Set new password" : "Guardar clave nueva"}
      </button>
    </form>
  );
}
