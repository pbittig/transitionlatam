import { getConnectionStatuses } from "@/lib/data-access/connectionStatuses";
import { getSeiaRecordForProject } from "@/lib/data-access/seia";
import { getProjectStakeholders, type ProjectDetail } from "@/lib/data-access/projects";
import { getConfirmedPertinenciaForProject } from "@/lib/data-access/pertinencias";
import { ProjectEditForm } from "./ProjectEditForm";
import { UnassignSeiaButton } from "./UnassignSeiaButton";
import { UnassignPertinenciaButton } from "./UnassignPertinenciaButton";
import { DeleteProjectButton } from "./DeleteProjectButton";
import { ProjectContactsEditor } from "./ProjectContactsEditor";
import { FormularioDocumentLink } from "../verificador/FormularioDocumentLink";
import { ProjectDocumentsBox } from "../verificador/ProjectDocumentsBox";
import { SeiaMatchModal } from "../../proyectos/[id]/SeiaMatchModal";
import { PertinenciaMatchModal } from "../../proyectos/[id]/PertinenciaMatchModal";
import { SeiaStatusCard } from "../../components/SeiaStatusCard";
import { PertinenciaStatusCard } from "../../components/PertinenciaStatusCard";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { isAdmin } from "@/lib/auth/session";

/** Cuerpo compartido de las pantallas de edición de admin (Verificador y Editar data) — el único que cambia entre ellas es el encabezado. */
export async function ProjectEditPageBody({
  project,
  backHref,
}: {
  project: ProjectDetail;
  backHref: string;
}) {
  if (!(await isAdmin())) return null;
  // Se crea dentro del Server Component para que el objeto Supabase (con
  // prototipos no serializables) nunca viaje como prop por el payload RSC.
  const client = createSupabaseServiceClient();
  const [connectionStatuses, seiaRecord, stakeholders, confirmedPertinencia] = await Promise.all([
    getConnectionStatuses(client),
    getSeiaRecordForProject(client, project.id),
    getProjectStakeholders(client, project.id, project.developerCompanyId, { skipCompanyFallback: true }),
    getConfirmedPertinenciaForProject(client, project.id),
  ]);

  return (
    <>
      <div className="flex flex-col items-end gap-2">
        <div className="flex flex-wrap items-start justify-end gap-2">
          <FormularioDocumentLink projectId={project.id} />
          <ProjectDocumentsBox projectId={project.id} />
        </div>
      </div>
      <ProjectEditForm project={project} connectionStatusOptions={connectionStatuses.map((s) => s.label)} />
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
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
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            Pertinencia SEA
          </h2>
          <div className="flex items-center gap-3">
            <PertinenciaMatchModal projectId={project.id} projectName={project.name} hasExistingMatch={!!confirmedPertinencia} isAdmin />
            {/* Solo cuando hay algo que quitar: un botón para soltar lo que no
                está asociado no hace nada y confunde sobre si lo estaba. */}
            {confirmedPertinencia && <UnassignPertinenciaButton projectId={project.id} />}
          </div>
        </div>
        <div className="mt-3">
          {confirmedPertinencia ? (
            <PertinenciaStatusCard record={confirmedPertinencia} />
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin pertinencia asociada todavía.</p>
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
