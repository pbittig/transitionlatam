import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getProjectById, type ProjectDetail } from "@/lib/data-access/projects";
import { isAdmin } from "@/lib/auth/session";
import { ProjectEditPageBody } from "../../components/ProjectEditPageBody";
import { VerifyButton } from "../VerifyButton";
import { AiSuggestionPanel } from "../AiSuggestionPanel";
import { FormularioDocumentLink } from "../FormularioDocumentLink";
import type { AiSuggestionResult } from "../aiSuggestionActions";
import { searchSeiaByName } from "@/lib/ingestion/sources/seia/searchApi";
import { distinctiveTokens } from "@/lib/ingestion/sources/seia/match";
import type { RawSeiaProject } from "@/lib/ingestion/sources/seia/types";

const MAX_SEIA_CANDIDATES = 10;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  if (!(await isAdmin())) return { title: "Verificar proyecto" };
  const { id } = await params;
  const client = await createSupabaseServerClient();
  const project = await getProjectById(client, id);
  return { title: project ? `Verificar — ${project.name}` : "Verificar proyecto" };
}

async function buildInitialAiResult(project: ProjectDetail): Promise<AiSuggestionResult | null> {
  if (!project.aiScreenedAt || !project.aiDataSanity) return null;

  let candidates: RawSeiaProject[] = [];
  if (project.aiSeiaPick) {
    const searchTerm = distinctiveTokens(project.name).join(" ");
    if (searchTerm) {
      try {
        const seiaResponse = await searchSeiaByName(searchTerm, MAX_SEIA_CANDIDATES);
        candidates = seiaResponse.data.slice(0, MAX_SEIA_CANDIDATES);
      } catch (err) {
        console.warn(`No se pudo obtener candidatos SEIA para el proyecto ${project.id}: ${(err as Error).message}`);
      }
    }
  }

  return {
    success: true,
    suggestion: {
      dataSanity: project.aiDataSanity,
      dataSanityReason: project.aiDataSanityReason ?? "",
      seiaPick: project.aiSeiaPick,
      seiaPickReason: project.aiSeiaPickReason ?? "",
    },
    candidates,
  };
}

export default async function VerificarProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return null;
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
        <div className="flex flex-col items-end gap-2">
          <VerifyButton projectId={project.id} />
          <FormularioDocumentLink projectId={project.id} />
        </div>
      </div>
      <AiSuggestionPanel projectId={project.id} initialResult={await buildInitialAiResult(project)} />
      <ProjectEditPageBody client={client} project={project} backHref="/admin/verificador" />
    </div>
  );
}
