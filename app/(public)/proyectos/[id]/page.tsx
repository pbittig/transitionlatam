import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getProjectById, getSimilarProjects } from "@/lib/data-access/projects";
import { getRelatedCompaniesByName } from "@/lib/data-access/coordinadorEmpresas";
import { getSeiaRecordForProject } from "@/lib/data-access/seia";
import { isProjectFollowed } from "@/lib/data-access/watchlist";
import { logProjectView } from "@/lib/data-access/behaviorEvent";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { isAdmin } from "@/lib/auth/session";
import { computeEstimatedPhase } from "@/lib/shared/computeEstimatedPhase";
import { getSeiaDurationRangeMonths } from "@/lib/shared/projectPhaseDurations";
import { computeHealthScore } from "@/lib/shared/projectHealthScore";
import {
  computeCodOutlook,
  computeCommercialWindow,
  computeNextMilestone,
  computeProjectSynthesis,
} from "@/lib/shared/projectIntelligence";
import { PhaseTimeline } from "./PhaseTimeline";
import { ProjectStatusSynthesis } from "./ProjectStatusSynthesis";
import { SimilarProjectsPanel } from "./SimilarProjectsPanel";
import { ThermalStatusBar } from "../../components/ThermalStatusBar";
import { SeiaStatusCard } from "../../components/SeiaStatusCard";
import { HealthScoreBadge } from "../../components/HealthScoreBadge";
import { SeiaMatchModal } from "./SeiaMatchModal";
import { RevealStakeholders } from "./RevealStakeholders";
import { PrintButton } from "./PrintButton";
import { FollowButton } from "./FollowButton";
import { AddToCrmButton } from "../../components/AddToCrmButton";
import { getActiveOpportunityProjectIds } from "@/lib/data-access/crmOpportunities";

export const dynamic = "force-dynamic";

/** Si falta el dato se muestra la etiqueta igual con "—" — visibiliza qué campos quedan por completar a mano, en vez de ocultarlos. */
function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  const isEmpty = value === null || value === undefined || value === "";
  return (
    <div>
      <dt className="text-xs text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd className={isEmpty ? "text-sm text-neutral-400 dark:text-neutral-600" : "text-sm font-medium text-neutral-900 dark:text-neutral-50"}>
        {isEmpty ? "—" : value}
      </dd>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold tracking-widest text-neutral-500 uppercase dark:text-neutral-400">
      {children}
    </h2>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const client = await createSupabaseServerClient();
  const project = await getProjectById(client, id);
  return { title: project?.name ?? "Proyecto" };
}

export default async function ProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await createSupabaseServerClient();
  const project = await getProjectById(client, id);
  if (!project) notFound();
  void logProjectView(client, project.id);

  const [relatedCompanies, seiaRecord, admin, similarProjects] = await Promise.all([
    getRelatedCompaniesByName(client, project.developerCompany),
    getSeiaRecordForProject(client, id),
    isAdmin(),
    getSimilarProjects(client, {
      id: project.id,
      technologyCode: project.technologyCode,
      capacityMw: project.capacityMw,
      region: project.region,
      voltageLevel: project.voltageLevel,
    }),
  ]);
  const followed = admin ? await isProjectFollowed(createSupabaseServiceClient(), id) : false;
  const alreadyInCrm = admin ? (await getActiveOpportunityProjectIds(createSupabaseServiceClient(), [id])).has(id) : false;

  const estimatedPhase = computeEstimatedPhase(
    project.estimatedConnectionDate,
    project.technologyCode,
    project.includesStorage,
    project.capacityMw,
  );
  const health = computeHealthScore(project.status, seiaRecord?.status ?? null, project.estimatedConnectionDate);
  const synthesis = computeProjectSynthesis(estimatedPhase, project.estimatedConnectionDate);
  const nextMilestone = computeNextMilestone(estimatedPhase);
  const commercialWindow = computeCommercialWindow(estimatedPhase);
  const codOutlook = computeCodOutlook(project.status, seiaRecord?.status ?? null, project.estimatedConnectionDate);

  const metaLine = [
    project.technology ?? "Tecnología no clasificada",
    project.includesStorage && !/bess/i.test(project.name) ? "+ BESS" : null,
    [project.comuna, project.region].filter(Boolean).join(", ") || null,
    project.developerCompany,
    project.capacityMw ? `${project.capacityMw} MW` : null,
    project.estimatedConnectionDate ? new Date(project.estimatedConnectionDate).toLocaleDateString("es-CL") : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-12">
      <div className="border-b border-neutral-100 pb-8 dark:border-neutral-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl dark:text-neutral-50">
              {project.name}
            </h1>
            <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-500">{project.internalCode}</p>
          </div>
          <div className="flex items-center gap-2">
            {admin && (
              <>
                <FollowButton projectId={project.id} initiallyFollowed={followed} />
                <AddToCrmButton
                  projectId={project.id}
                  projectName={project.name}
                  developerCompanyId={project.developerCompanyId}
                  initiallyInCrm={alreadyInCrm}
                />
              </>
            )}
            <PrintButton />
          </div>
        </div>
        <p className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-sm text-neutral-500 dark:text-neutral-400">
          {metaLine.map((item, i) => (
            <span key={i}>
              {item}
              {i < metaLine.length - 1 && <span className="mx-2 text-neutral-300 dark:text-neutral-700">·</span>}
            </span>
          ))}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 md:grid-cols-4">
          <Field label="RUT" value={project.developerCompanyRut} />
          <Field label="Dirección legal" value={project.developerCompanyAddress} />
          <Field label="SPV" value={project.spv} />
          <Field label="Tipo de solicitud" value={project.requestType} />
          {project.includesStorage && (
            <>
              <Field label="Potencia de generación" value={project.generationCapacityMw ? `${project.generationCapacityMw} MW` : null} />
              <Field label="Potencia de almacenamiento" value={project.storageCapacityMw ? `${project.storageCapacityMw} MW` : null} />
              <Field label="Energía" value={project.capacityMwh ? `${project.capacityMwh} MWh` : null} />
              <Field label="Horas de almacenamiento" value={project.storageHours} />
            </>
          )}
          <Field label="Punto de conexión" value={project.connectionPoint} />
          <Field label="Nivel de tensión" value={project.voltageLevel ? `${project.voltageLevel} kV` : null} />
          <Field label="NUP" value={project.nup} />
        </dl>
      </div>

      {synthesis && (
        <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900">
          <SectionLabel>Estado del Proyecto</SectionLabel>
          <div className="mt-3">
            <ProjectStatusSynthesis
              synthesis={synthesis}
              nextMilestone={nextMilestone}
              commercialWindow={commercialWindow}
              codOutlook={codOutlook}
            />
          </div>
        </section>
      )}

      {health.score !== null && (
        <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900">
          <SectionLabel>Health Score</SectionLabel>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <HealthScoreBadge health={health} />
            <p className="max-w-xl text-xs text-neutral-500 dark:text-neutral-400">
              Lectura propia combinada del avance del proyecto — no es un dato oficial. Pondera el avance del trámite
              de conexión
              {health.seiaScore !== null
                ? " (60%) y del trámite ambiental SEIA (40%)"
                : " (100%, sin expediente SEIA asociado)"}
              {health.overdue
                ? "; penalizado porque la fecha estimada de conexión ya pasó sin llegar a construcción"
                : ""}
              .
            </p>
          </div>
        </section>
      )}

      {project.status && (
        <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900">
          <SectionLabel>Estado del proceso de conexión</SectionLabel>
          <p className="mt-3 mb-3 text-sm text-neutral-900 dark:text-neutral-50">{project.status}</p>
          <ThermalStatusBar status={project.status} />
        </section>
      )}

      {estimatedPhase && (
        <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900">
          <div className="flex items-center gap-2">
            <SectionLabel>Etapa estimada de desarrollo</SectionLabel>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              Estimado · {estimatedPhase.groupLabel}
            </span>
          </div>
          <p className="mt-3 mb-4 text-sm text-neutral-600 dark:text-neutral-400">
            {estimatedPhase.pastConnectionDate
              ? "La fecha estimada de conexión ya pasó — el proyecto debería estar en operación."
              : estimatedPhase.currentPhase
                ? `Con base en la fecha estimada de conexión y duraciones típicas de mercado para este tipo de proyecto (${estimatedPhase.groupLabel}), el proyecto debería estar en: ${
                    estimatedPhase.milestones.find((m) => m.phase === estimatedPhase.currentPhase)!.label
                  }.`
                : "Aún no debería haber iniciado desarrollo según la fecha estimada de conexión."}{" "}
            No es un dato confirmado del proyecto — es un modelo probabilístico (mínimo / más probable / máximo)
            calculado hacia atrás desde la fecha estimada de conexión reportada por el Coordinador Eléctrico
            Nacional. Duración total estimada: ~{Math.round(estimatedPhase.totalDurationMonths)} meses. Las bandas
            rayadas muestran el rango real (no un ± fijo) de cada etapa, y la confianza de cada una baja mientras
            más lejos está del COD.
          </p>
          <PhaseTimeline milestones={estimatedPhase.milestones} connectionDate={project.estimatedConnectionDate!} />
        </section>
      )}

      <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900">
        <div className="flex items-center justify-between">
          <SectionLabel>Estado ambiental</SectionLabel>
          <SeiaMatchModal projectId={project.id} hasExistingMatch={!!seiaRecord} isAdmin={admin} />
        </div>
        <div className="mt-3">
          {seiaRecord ? (
            <SeiaStatusCard record={seiaRecord} />
          ) : (
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin expediente SEIA asociado todavía.</p>
              {estimatedPhase &&
                (() => {
                  const seiaRange = getSeiaDurationRangeMonths(estimatedPhase.group);
                  if (!seiaRange) return null;
                  return (
                    <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
                      Para {estimatedPhase.groupLabel}, la tramitación SEIA suele tomar entre {seiaRange.min} y{" "}
                      {seiaRange.max} meses (típico ~{seiaRange.likely}) — estimación de mercado, no un dato del
                      proyecto.
                    </p>
                  );
                })()}
            </div>
          )}
        </div>
      </section>

      {relatedCompanies && (
        <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900">
          <div className="flex items-center gap-2">
            <SectionLabel>Empresas relacionadas</SectionLabel>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              Coordinador Eléctrico Nacional
            </span>
          </div>
          <p className="mt-3 mb-3 text-sm text-neutral-600 dark:text-neutral-400">
            Empresas que el Coordinador agrupa junto a {project.developerCompany} bajo el mismo grupo corporativo.
          </p>
          <ul className="flex flex-wrap gap-2">
            {relatedCompanies.relatedNames.map((name) => (
              <li
                key={name}
                className="rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-700 dark:border-neutral-800 dark:text-neutral-300"
              >
                {name}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900">
        <SectionLabel>Proyectos similares</SectionLabel>
        <div className="mt-3">
          <SimilarProjectsPanel projects={similarProjects} />
        </div>
      </section>

      <section>
        <SectionLabel>Contactos</SectionLabel>
        <div className="mt-4">
          <RevealStakeholders projectId={project.id} developerCompanyId={project.developerCompanyId} isAdmin={admin} />
        </div>
      </section>
    </div>
  );
}
