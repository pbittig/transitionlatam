import Link from "next/link";
import type { Metadata } from "next";
import { ShieldCheck, PencilLine, Inbox, Users } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { countUnverifiedProjects } from "@/lib/data-access/projects";
import { isAdmin } from "@/lib/auth/session";
import { Panel } from "../components/Panel";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { getEditorialCounts } from "@/lib/data-access/editorialQueue";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) return null;
  const client = await createSupabaseServerClient();
  const [pendingCount, editorialCounts] = await Promise.all([
    countUnverifiedProjects(client),
    getEditorialCounts(createSupabaseServiceClient()),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Admin</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">Herramientas internas de mantenimiento de datos.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/admin/trabajo-hoy">
          <Panel className="flex flex-col gap-2 border-brand-primary/30 hover:border-brand-primary">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
              <Inbox size={18} /> Trabajo de hoy
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {editorialCounts.today.toLocaleString("es-CL")} nuevos hoy · {editorialCounts.backlog.toLocaleString("es-CL")} en backlog.
            </p>
          </Panel>
        </Link>
        <Link href="/admin/verificador">
          <Panel className="flex flex-col gap-2 hover:border-neutral-300 dark:hover:border-neutral-700">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
              <ShieldCheck size={18} /> Verificador de proyecto
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {pendingCount.toLocaleString("es-CL")} proyectos pendientes de revisar.
            </p>
          </Panel>
        </Link>
        <Link href="/admin/editar-data">
          <Panel className="flex flex-col gap-2 hover:border-neutral-300 dark:hover:border-neutral-700">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
              <PencilLine size={18} /> Editar data
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Busca y corrige cualquier ficha de proyecto.</p>
          </Panel>
        </Link>
        <Link href="/admin/usuarios">
          <Panel className="flex flex-col gap-2 hover:border-neutral-300 dark:hover:border-neutral-700">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
              <Users size={18} /> Usuarios
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Crea cuentas, habilita accesos y asigna planes.</p>
          </Panel>
        </Link>
      </div>
    </div>
  );
}
