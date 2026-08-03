"use client";

import { useActionState } from "react";
import { accessAdmin, type AdminAccessState } from "./actions";

const initialState: AdminAccessState = {};

export function AdminAccessForm() {
  const [state, formAction, pending] = useActionState(accessAdmin, initialState);

  return (
    <form action={formAction} className="mt-7 flex flex-col gap-4">
      <div>
        <label htmlFor="username" className="mb-1 block text-sm font-medium text-neutral-700">
          Usuario
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          autoFocus
          required
          className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-neutral-700">
          Clave
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
        />
      </div>
      {state?.error && (
        <p aria-live="polite" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-[#333333] transition hover:brightness-95 disabled:opacity-50"
      >
        {pending ? "Verificando…" : "Ingresar como administrador"}
      </button>
    </form>
  );
}
