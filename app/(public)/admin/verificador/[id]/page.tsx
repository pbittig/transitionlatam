import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getProjectById } from "@/lib/data-access/projects";
import { ProjectEditPageBody } from "../../components/ProjectEditPageBody";
import { VerifyButton } from "../VerifyButton";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const client = await createSupabaseServerClient();
  const project = await getProjectById(client, id);
  return { title: project ? `Verificar — ${project.name}` : "Verificar proyecto" };
}

export default async function VerificarProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await createSupabaseServerClient();
  const project = await getProjectById(client, id);
  if (!project) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">Verificando</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            {project.name}
          </h1>
        </div>
        <VerifyButton projectId={project.id} />
      </div>
      <ProjectEditPageBody client={client} project={project} />
    </div>
  );
}
