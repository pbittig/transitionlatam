import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { getProjectById } from "@/lib/data-access/projects";
import { isAdmin } from "@/lib/auth/session";
import { ProjectEditPageBody } from "../../components/ProjectEditPageBody";
import { VerifyButton } from "../VerifyButton";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  if (!(await isAdmin())) return { title: "Verificar proyecto" };
  const { id } = await params;
  // Mismo motivo que en el cuerpo de la página: la sesión de admin no es de
  // Supabase, así que el cliente de sesión consulta como `anon` y el título
  // saldría genérico.
  const client = createSupabaseServiceClient();
  const project = await getProjectById(client, id);
  return { title: project ? `Verificar — ${project.name}` : "Verificar proyecto" };
}

export default async function VerificarProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return null;
  const { id } = await params;
  // La sesión admin de esta app es una cookie propia, no una sesión de Supabase.
  // Tras validar isAdmin() usamos service_role server-side para que la consulta
  // de `person` no quede vacía por la RLS de contactos.
  const client = createSupabaseServiceClient();
  const project = await getProjectById(client, id);
  if (!project) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            {project.name}
          </h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <VerifyButton projectId={project.id} publishes={project.editorialStatus === "pending"} />
        </div>
      </div>
      <ProjectEditPageBody
        project={project}
        backHref={project.editorialStatus === "pending" ? "/admin/trabajo-hoy" : "/admin/verificador"}
      />
    </div>
  );
}
