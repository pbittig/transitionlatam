import Link from "next/link";
import type { Metadata } from "next";
import { ShieldCheck, PencilLine } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { countUnverifiedProjects } from "@/lib/data-access/projects";
import { Panel } from "../components/Panel";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const client = await createSupabaseServerClient();
  const pendingCount = await countUnverifiedProjects(client);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Admin</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">Herramientas internas de mantenimiento de datos.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>
    </div>
  );
}
