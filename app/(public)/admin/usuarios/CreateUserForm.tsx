"use client";

import { useActionState } from "react";
import { createUserAction, type UserActionState } from "./actions";

export function CreateUserForm({ plans }: { plans: Array<{ id: string; code: string; name: string }> }) {
  const [state, action, pending] = useActionState<UserActionState, FormData>(createUserAction, {});
  return (
    <form action={action} className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-5 md:grid-cols-2 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="md:col-span-2">
        <h2 className="text-lg font-semibold">Crear usuario</h2>
        <p className="text-sm text-neutral-500">La cuenta quedará confirmada y habilitada inmediatamente.</p>
      </div>
      <label className="grid gap-1 text-sm">Nombre
        <input name="fullName" className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700" />
      </label>
      <label className="grid gap-1 text-sm">Correo
        <input required name="email" type="email" autoComplete="off" className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700" />
      </label>
      <label className="grid gap-1 text-sm">Contraseña temporal
        <input required name="password" type="password" minLength={10} autoComplete="new-password" className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700" />
      </label>
      <label className="grid gap-1 text-sm">Plan
        <select required name="planId" className="rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950">
          {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-3 md:col-span-2">
        <button disabled={pending} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
          {pending ? "Creando…" : "Crear usuario"}
        </button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.success && <p className="text-sm text-emerald-600">{state.success}</p>}
      </div>
    </form>
  );
}
