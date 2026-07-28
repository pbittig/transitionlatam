import type { SupabaseClient } from "@supabase/supabase-js";
import { getConnectionStatuses } from "@/lib/data-access/connectionStatuses";
import { getSeiaRecordForProject } from "@/lib/data-access/seia";
import { getProjectStakeholders, type ProjectDetail } from "@/lib/data-access/projects";
import { ProjectEditForm } from "./ProjectEditForm";
import { UnassignSeiaButton } from "./UnassignSeiaButton";
import { DeleteProjectButton } from "./DeleteProjectButton";
import { ProjectContactsEditor } from "./ProjectContactsEditor";
import { FormularioDocumentLink } from "../verificador/FormularioDocumentLink";
import { SeiaMatchModal } from "../../proyectos/[id]/SeiaMatchModal";
import { SeiaStatusCard } from "../../components/SeiaStatusCard";

/** Cuerpo compartido de las pantallas de edición de admin (Verificador y Editar data) — el único que cambia entre ellas es el encabezado. */
export async function ProjectEditPageBody({
  client,
  project,
  backHref,
}: {
  client: SupabaseClient;
  project: ProjectDetail;
  backHref: string;
}) {
  const [connectionStatuses, seiaRecord, stakeholders] = await Promise.all([
    getConnectionStatuses(client),
    getSeiaRecordForProject(client, project.id),
    getProjectStakeholders(client, project.id, project.developerCompanyId, { skipCompanyFallback: true }),
  ]);

  return (
    <>
      <div className="flex justify-end">
        <FormularioDocumentLink projectId={project.id} />
      </div>
      <ProjectEditForm project={project} connectionStatusOptions={connectionStatuses.map((s) => s.label)} />
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-widest text-neutral-500 uppercase dark:text-neutral-400">
            Estado ambiental
          </h2>
          <div className="flex items-center gap-3">
            <SeiaMatchModal projectId={project.id} projectName={project.name} hasExistingMatch={!!seiaRecord} isAdmin />
            {seiaRecord && <UnassignSeiaButton projectId={project.id} />}
          </div>
        </div>
        <div className="mt-3">
          {seiaRecord ? (
            <SeiaStatusCard record={seiaRecord} />
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin expediente SEIA asociado todavía.</p>
          )}
        </div>
      </div>
      <ProjectContactsEditor projectId={project.id} initialContacts={stakeholders} />
      <div className="flex justify-end border-t border-neutral-100 pt-4 dark:border-neutral-900">
        <DeleteProjectButton projectId={project.id} backHref={backHref} />
      </div>
    </>
  );
}
