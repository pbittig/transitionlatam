import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getProjectById, getRelatedPortfolioProjects, getSimilarProjects, getProjectStakeholders } from "@/lib/data-access/projects";
import { maskName, maskEmail } from "@/lib/shared/maskContact";
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
import { ProjectProcessProgress } from "./ProjectProcessProgress";
import { SimilarProjectsPanel } from "./SimilarProjectsPanel";
import { RelatedProjectsPanel } from "./RelatedProjectsPanel";
import { SeiaStatusCard } from "../../components/SeiaStatusCard";
import { HealthScoreBadge } from "../../components/HealthScoreBadge";
import { SeiaMatchModal } from "./SeiaMatchModal";
import { RevealStakeholders } from "./RevealStakeholders";
import { FollowButton } from "./FollowButton";
import { AddToCrmButton } from "../../components/AddToCrmButton";
import { getActiveOpportunityProjectIds } from "@/lib/data-access/crmOpportunities";
import { chipLabelForProject } from "../../components/techChips";
import { PlanGate } from "../../components/PlanGate";
import { getAppLocale } from "@/lib/i18n";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";
import { ShareProjectButton } from "./ShareProjectButton";

export const dynamic = "force-dynamic";

/** Si falta el dato se muestra la etiqueta igual con "—" — visibiliza qué campos quedan por completar a mano, en vez de ocultarlos. */
function Field({ label, value, locked = false }: { label: string; value: string | number | null | undefined; locked?: boolean }) {
  const isEmpty = value === null || value === undefined || value === "";
  return (
    <div>
      <dt className="text-xs text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd className={isEmpty ? "text-sm text-neutral-400 dark:text-neutral-600" : "text-sm font-medium text-neutral-900 dark:text-neutral-50"}>
        <PlanGate locked={locked && !isEmpty}>{isEmpty ? "—" : value}</PlanGate>
      </dd>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
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
  const locale = await getAppLocale();
  const { id } = await params;
  const client = await createSupabaseServerClient();
  const project = await getProjectById(client, id);
  if (!project) notFound();
  void logProjectView(client, project.id);

  const [relatedCompanies, seiaRecord, admin, similarProjects, profile] = await Promise.all([
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
    getCurrentUserProfile(client),
  ]);
  const isFree = !admin && profile?.planCode !== "premium";
  const teamLocked = !admin && profile?.planCode !== "premium";
  // Solo el nombre/correo enmascarado llega al cliente cuando está bloqueado —
  // el dato real nunca sale del servidor para un usuario sin Premium.
  const maskedContactPreview = teamLocked
    ? (
        await getProjectStakeholders(createSupabaseServiceClient(), project.id, project.developerCompanyId, {
          skipCompanyFallback: true,
        })
      ).map((s) => ({ name: maskName(s.name), email: s.email ? maskEmail(s.email) : null }))
    : [];
  const visibleStakeholders = teamLocked
    ? null
    : await getProjectStakeholders(createSupabaseServiceClient(), project.id, project.developerCompanyId, {
        skipCompanyFallback: true,
      });
  const relatedPortfolioProjects = teamLocked
    ? []
    : await getRelatedPortfolioProjects(client, {
        id: project.id,
        developerCompanyId: project.developerCompanyId,
        developerCompanyName: project.developerCompany,
        relatedCompanyNames: relatedCompanies?.relatedNames,
      });
  const canInteract = admin || !isFree;
  const followed = canInteract ? await isProjectFollowed(createSupabaseServiceClient(), id) : false;
  const alreadyInCrm = canInteract ? (await getActiveOpportunityProjectIds(admin ? createSupabaseServiceClient() : client, [id])).has(id) : false;

  const estimatedPhase = computeEstimatedPhase(
    project.estimatedConnectionDate,
    project.technologyCode,
    project.includesStorage,
    project.capacityMw,
  );
  const health = computeHealthScore(project.status, seiaRecord?.status ?? null, project.estimatedConnectionDate, new Date(), {
    projectKind: project.projectKind,
    includesStorage: project.includesStorage,
    seiaSubmissionType: seiaRecord?.submissionType,
  });
  const synthesis = computeProjectSynthesis(estimatedPhase, project.estimatedConnectionDate);
  const nextMilestone = computeNextMilestone(estimatedPhase);
  const commercialWindow = computeCommercialWindow(estimatedPhase);
  const codOutlook = computeCodOutlook(project.status, seiaRecord?.status ?? null, project.estimatedConnectionDate);

  const baseTechLabel = chipLabelForProject(project.technologyCode, project.name);
  const technologyLabel =
    project.includesStorage && baseTechLabel !== "BESS" && !/bess/i.test(project.name)
      ? `${baseTechLabel} + BESS`
      : baseTechLabel;

  return (
    <div className="flex flex-col gap-12">
      <div className="border-b border-neutral-100 pb-8 dark:border-neutral-900">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl dark:text-neutral-50">
              {project.name}
            </h1>
            <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-500">{project.internalCode}</p>
          </div>
          <div className="flex items-center gap-2">
            <ShareProjectButton projectName={project.name} locale={locale} />
            <FollowButton projectId={project.id} initiallyFollowed={followed} locked={isFree} />
            <AddToCrmButton
              projectId={project.id}
              projectName={project.name}
              developerCompanyId={project.developerCompanyId}
              initiallyInCrm={alreadyInCrm}
              locked={isFree}
            />
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 md:grid-cols-4">
          <Field label={locale === "en" ? "Technology" : "Tecnología"} value={technologyLabel} />
          <Field label={locale === "en" ? "Location" : "Ubicación"} value={[project.comuna, project.region].filter(Boolean).join(", ") || null} />
          <Field label="RUT" value={project.developerCompanyRut} locked={isFree} />
          <Field label={locale === "en" ? "Registered address" : "Dirección legal"} value={project.developerCompanyAddress} locked={isFree} />
          <Field label={locale === "en" ? "SPV/Owner" : "SPV/Propietario"} value={project.spv} locked={isFree} />
          {project.includesStorage && (
            <>
              <Field label={locale === "en" ? "Storage capacity" : "Potencia de almacenamiento"} value={project.storageCapacityMw ? `${project.storageCapacityMw} MW` : null} />
              <Field label={locale === "en" ? "Energy" : "Energía"} value={project.capacityMwh ? `${project.capacityMwh} MWh` : null} />
              <Field label={locale === "en" ? "Storage duration" : "Horas de almacenamiento"} value={project.storageHours} />
            </>
          )}
          <Field label={locale === "en" ? "Connection point" : "Punto de conexión"} value={project.connectionPoint} />
          <Field label={locale === "en" ? "Voltage level" : "Nivel de tensión"} value={project.voltageLevel ? `${project.voltageLevel} kV` : null} />
          <Field
            label={locale === "en" ? "Project connection date" : "Fecha de conexión del proyecto"}
            value={project.estimatedConnectionDate ? new Date(project.estimatedConnectionDate).toLocaleDateString(locale === "en" ? "en-GB" : "es-CL") : null}
          />
        </dl>
      </div>

      {synthesis && (
        <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900">
          <SectionLabel>{locale === "en" ? "Project status" : "Estado del Proyecto"}</SectionLabel>
          <div className="mt-3">
            <PlanGate locked={isFree}>
              <ProjectStatusSynthesis
                synthesis={synthesis}
                nextMilestone={nextMilestone}
                commercialWindow={commercialWindow}
                codOutlook={codOutlook}
                locale={locale}
              />
            </PlanGate>
          </div>
        </section>
      )}

      {health.score !== null && (
        <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900">
          <SectionLabel>Health Score</SectionLabel>
          <PlanGate locked={isFree}>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <HealthScoreBadge health={health} />
              <p className="max-w-xl text-xs text-neutral-500 dark:text-neutral-400">
                {locale === "en" ? "Transition LATAM assessment combining project progress; this is not official data. It weighs connection progress" : "Lectura propia combinada del avance del proyecto — no es un dato oficial. Pondera el avance del trámite de conexión"}
                {health.seiaScore !== null
                  ? locale === "en" ? " (60%) and SEIA environmental progress (40%)" : " (60%) y del trámite ambiental SEIA (40%)"
                  : locale === "en" ? " (100%, with no linked SEIA filing)" : " (100%, sin expediente SEIA asociado)"}
                {health.overdue
                  ? locale === "en" ? "; penalized because the estimated connection date has passed without reaching construction" : "; penalizado porque la fecha estimada de conexión ya pasó sin llegar a construcción"
                  : ""}
                .
              </p>
            </div>
          </PlanGate>
        </section>
      )}

      <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900">
        <SectionLabel>{locale === "en" ? "Permitting progress" : "Avance de tramitación"}</SectionLabel>
        <div className="mt-3">
          <PlanGate locked={isFree}>
            <ProjectProcessProgress
              connectionStatus={project.status}
              environmentalStatus={seiaRecord?.status ?? null}
              locale={locale}
            />
          </PlanGate>
        </div>
      </section>

      {estimatedPhase && (
        <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900">
          <SectionLabel>{locale === "en" ? "Estimated development stage" : "Etapa estimada de desarrollo"}</SectionLabel>
          <PlanGate locked={isFree}>
            <div className="mt-3 flex items-center gap-2">
              <span className="rounded-full bg-brand-surface px-2 py-0.5 text-xs font-medium text-brand-deep">
                {locale === "en" ? "Estimated" : "Estimado"} · {estimatedPhase.groupLabel}
              </span>
            </div>
            <p className="mt-3 mb-4 text-sm text-neutral-600 dark:text-neutral-400">
              {locale === "en" ? (
                estimatedPhase.pastConnectionDate
                  ? "The estimated connection date has passed; the project should already be operational. "
                  : estimatedPhase.currentPhase
                    ? `Based on the estimated connection date and typical market durations, the project should currently be in ${estimatedPhase.milestones.find((m) => m.phase === estimatedPhase.currentPhase)!.label}. `
                    : "Development should not have started yet based on the estimated connection date. "
              ) : estimatedPhase.pastConnectionDate
                ? "La fecha estimada de conexión ya pasó — el proyecto debería estar en operación."
                : estimatedPhase.currentPhase
                  ? `Con base en la fecha estimada de conexión y duraciones típicas de mercado para este tipo de proyecto (${estimatedPhase.groupLabel}), el proyecto debería estar en: ${
                      estimatedPhase.milestones.find((m) => m.phase === estimatedPhase.currentPhase)!.label
                    }.`
                  : "Aún no debería haber iniciado desarrollo según la fecha estimada de conexión."}{" "}
              {locale === "en" ? `This is not confirmed project data; it is a probabilistic model calculated backwards from the connection date reported by the National Electricity Coordinator. Estimated total duration: approximately ${Math.round(estimatedPhase.totalDurationMonths)} months.` : <>No es un dato confirmado del proyecto — es un modelo probabilístico (mínimo / más probable / máximo)
              calculado hacia atrás desde la fecha estimada de conexión reportada por el Coordinador Eléctrico
              Nacional. Duración total estimada: ~{Math.round(estimatedPhase.totalDurationMonths)} meses. Las bandas
              rayadas muestran el rango real (no un ± fijo) de cada etapa, y la confianza de cada una baja mientras
              más lejos está del COD.</>}
            </p>
            <PhaseTimeline milestones={estimatedPhase.milestones} connectionDate={project.estimatedConnectionDate!} locale={locale} />
          </PlanGate>
        </section>
      )}

      <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900">
        <SectionLabel>{locale === "en" ? "Contact" : "Contacto"}</SectionLabel>
        <div className="mt-4">
          <RevealStakeholders
            projectId={project.id}
            developerCompanyId={project.developerCompanyId}
            canReveal={!teamLocked}
            initialStakeholders={visibleStakeholders}
            maskedPreview={maskedContactPreview}
            locale={locale}
          />
        </div>
      </section>

      <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900">
        <div className="flex items-center justify-between">
          <SectionLabel>{locale === "en" ? "Environmental details" : "Detalle ambiental"}</SectionLabel>
          {admin && (
            <SeiaMatchModal
              projectId={project.id}
              projectName={project.name}
              hasExistingMatch={!!seiaRecord}
              isAdmin
            />
          )}
        </div>
        <div className="mt-3">
          <PlanGate locked={isFree}>
            {seiaRecord ? (
              <SeiaStatusCard record={seiaRecord} locale={locale} />
            ) : (
              <div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">{locale === "en" ? "No SEIA filing has been linked yet." : "Sin expediente SEIA asociado todavía."}</p>
                {estimatedPhase &&
                  (() => {
                    const seiaRange = getSeiaDurationRangeMonths(estimatedPhase.group);
                    if (!seiaRange) return null;
                    return (
                      <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
                        {locale === "en" ? `For this project type, SEIA processing typically takes between ${seiaRange.min} and ${seiaRange.max} months (typical: approximately ${seiaRange.likely}); this is a market estimate, not project data.` : <>Para {estimatedPhase.groupLabel}, la tramitación SEIA suele tomar entre {seiaRange.min} y{" "}{seiaRange.max} meses (típico ~{seiaRange.likely}) — estimación de mercado, no un dato del proyecto.</>}
                      </p>
                    );
                  })()}
              </div>
            )}
          </PlanGate>
        </div>
      </section>

      {relatedCompanies && (
        <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900">
          <div className="flex items-center gap-2">
            <SectionLabel>{locale === "en" ? "Related companies" : "Empresas relacionadas"}</SectionLabel>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              Coordinador Eléctrico Nacional
            </span>
          </div>
          <p className="mt-3 mb-3 text-sm text-neutral-600 dark:text-neutral-400">
            {locale === "en" ? `Companies grouped by the National Electricity Coordinator with ${project.developerCompany} under the same corporate group.` : `Empresas que el Coordinador agrupa junto a ${project.developerCompany} bajo el mismo grupo corporativo.`}
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
        <SectionLabel>{locale === "en" ? "Related projects" : "Proyectos relacionados"}</SectionLabel>
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
          {locale === "en"
            ? "Other verified active projects linked through the same SPV, developer, owner or corporate group, with their estimated development stage."
            : "Otros proyectos activos verificados vinculados por SPV, desarrollador, propietario o grupo empresarial, junto con su etapa estimada de desarrollo."}
        </p>
        <div className="mt-4">
          <PlanGate
            locked={teamLocked}
            label={locale === "en" ? "Related projects available on Prime" : "Proyectos relacionados disponibles en Prime"}
          >
            <RelatedProjectsPanel projects={relatedPortfolioProjects} locale={locale} />
          </PlanGate>
        </div>
      </section>

      <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900">
        <SectionLabel>{locale === "en" ? "Similar projects" : "Proyectos similares"}</SectionLabel>
        <div className="mt-3">
          <SimilarProjectsPanel projects={similarProjects} locale={locale} />
        </div>
      </section>

    </div>
  );
}
