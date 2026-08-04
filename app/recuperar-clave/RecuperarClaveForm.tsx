"use client";

import { useActionState } from "react";
import { recuperarClave, type RecuperarClaveState } from "./actions";
import type { AppLocale } from "@/lib/i18n";

const initialState: RecuperarClaveState = {};

export function RecuperarClaveForm({ locale = "es" }: { locale?: AppLocale }) {
  const [state, formAction, pending] = useActionState(recuperarClave, initialState);

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
      {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-[#333333] shadow-sm transition hover:brightness-95 disabled:opacity-50"
      >
        {pending
          ? locale === "en"
            ? "Sending..."
            : "Enviando..."
          : locale === "en"
            ? "Send reset link"
            : "Enviar link de restablecimiento"}
      </button>
    </form>
  );
}
