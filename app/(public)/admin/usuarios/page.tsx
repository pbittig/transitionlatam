import type { Metadata } from "next";
import { listAdminUsers, listPlans } from "@/lib/data-access/adminUsers";
import { CreateUserForm } from "./CreateUserForm";
import { setUserEnabledAction, updateUserPlanAction } from "./actions";

export const metadata: Metadata = { title: "Usuarios · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const [users, plans] = await Promise.all([listAdminUsers(), listPlans()]);
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Usuarios</h1>
        <p className="mt-2 text-neutral-500">{users.length} cuentas registradas. Crea accesos, asigna planes y controla su estado.</p>
      </div>
      <CreateUserForm plans={plans} />
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full min-w-[850px] text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
            <tr><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Último acceso</th><th className="px-4 py-3">Acción</th></tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-neutral-100 dark:border-neutral-900">
                <td className="px-4 py-3"><div className="font-medium">{user.fullName || user.email}</div><div className="text-xs text-neutral-500">{user.email}</div></td>
                <td className="px-4 py-3">
                  <form action={updateUserPlanAction} className="flex gap-2">
                    <input type="hidden" name="userId" value={user.id} />
                    <select name="planId" defaultValue={plans.find((p) => p.code === user.planCode)?.id} className="rounded-lg border border-neutral-300 bg-transparent px-2 py-1.5 dark:border-neutral-700">
                      {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
                    </select>
                    <button className="text-xs font-medium underline">Guardar</button>
                  </form>
                </td>
                <td className="px-4 py-3"><span className={user.enabled ? "text-emerald-600" : "text-red-600"}>{user.enabled ? "Habilitado" : "Deshabilitado"}</span></td>
                <td className="px-4 py-3 text-neutral-500">{user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString("es-CL") : "Nunca"}</td>
                <td className="px-4 py-3">
                  <form action={setUserEnabledAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="enabled" value={String(!user.enabled)} />
                    <button className={user.enabled ? "text-red-600 hover:underline" : "text-emerald-600 hover:underline"}>{user.enabled ? "Deshabilitar" : "Habilitar"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
