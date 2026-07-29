import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { getProjectById } from "@/lib/data-access/projects";
import { isAdmin } from "@/lib/auth/session";
import { ProjectEditPageBody } from "../../components/ProjectEditPageBody";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  if (!(await isAdmin())) return { title: "Editar proyecto" };
  const { id } = await params;
  const client = await createSupabaseServerClient();
  const project = await getProjectById(client, id);
  return { title: project ? `Editar — ${project.name}` : "Editar proyecto" };
}

export default async function EditarProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return null;
  const { id } = await params;
  // La sesión admin es propia de la app; service_role se usa solo después de
  // isAdmin() para poder leer `person`, protegida por RLS en Supabase.
  const client = createSupabaseServiceClient();
  const project = await getProjectById(client, id);
  if (!project) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">Editando</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          {project.name}
        </h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          {project.verifiedAt
            ? `Verificado el ${new Date(project.verifiedAt).toLocaleDateString("es-CL")}`
            : "Pendiente de verificación"}
        </p>
      </div>
      <ProjectEditPageBody project={project} backHref="/admin/editar-data" />
    </div>
  );
}
