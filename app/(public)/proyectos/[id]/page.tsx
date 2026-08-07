import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getProjectById, getRelatedPortfolioProjects, getProjectStakeholders } from "@/lib/data-access/projects";
import { maskName, maskEmail } from "@/lib/shared/maskContact";
import { getRelatedCompaniesByName } from "@/lib/data-access/coordinadorEmpresas";
import { getSeiaRecordForProject } from "@/lib/data-access/seia";
import { isProjectFollowed } from "@/lib/data-access/watchlist";
import { logProjectView } from "@/lib/data-access/behaviorEvent";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { isAdmin } from "@/lib/auth/session";
import { computeEstimatedPhase } from "@/lib/shared/computeEstimatedPhase";
import { computeHealthScore } from "@/lib/shared/projectHealthScore";
import {
  computeCodOutlook,
  computeCommercialWindow,
  computeNextMilestone,
  computeProjectSynthesis,
} from "@/lib/shared/projectIntelligence";
import { PhaseTimeline, type PgpTimelineMilestone } from "./PhaseTimeline";
import { ProjectStatusSynthesis } from "./ProjectStatusSynthesis";
import { ProjectProcessProgress } from "./ProjectProcessProgress";
import { RelatedProjectsPanel } from "./RelatedProjectsPanel";
import { SeiaStatusCard } from "../../components/SeiaStatusCard";
import { PertinenciaStatusCard } from "../../components/PertinenciaStatusCard";
import { getConfirmedPertinenciaForProject } from "@/lib/data-access/pertinencias";
import { formatRutForDisplay } from "@/lib/shared/formatRut";
import { HealthScoreBadge } from "../../components/HealthScoreBadge";
import { SeiaMatchModal } from "./SeiaMatchModal";
import { PertinenciaMatchModal } from "./PertinenciaMatchModal";
import { RevealStakeholders } from "./RevealStakeholders";
import { FollowButton } from "./FollowButton";
import { AddToCrmButton } from "../../components/AddToCrmButton";
import { getActiveOpportunityProjectIds } from "@/lib/data-access/crmOpportunities";
import { chipLabelForProject } from "../../components/techChips";
import { PlanGate } from "../../components/PlanGate";
import { getAppLocale, type AppLocale } from "@/lib/i18n";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";
import { ShareProjectButton } from "./ShareProjectButton";
import { InfoTooltip } from "../../components/InfoTooltip";
import { getProjectOwnershipMap } from "@/lib/data-access/projectOwnership";
import { ProjectOwnershipSection } from "./ProjectOwnershipSection";
import { getLatestPgpProgress } from "@/lib/data-access/pgpProgress";
import { getCodSlippageCalibration } from "@/lib/data-access/scheduleCalibration";
import { dateForExpectedProgress, hasConstructionStartGap, interpretPgpProgress } from "@/lib/shared/pgpProjectProgress";

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

function SectionLabel({ children, info, locale }: { children: React.ReactNode; info?: string; locale: AppLocale }) {
  const heading = (
    <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
      {children}
    </h2>
  );
  if (!info) return heading;
  return (
    <div className="flex items-center gap-1.5">
      {heading}
      <InfoTooltip text={info} locale={locale} />
    </div>
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

  const [relatedCompanies, seiaRecord, confirmedPertinencia, admin, profile, pgpProgress, scheduleCalibration] = await Promise.all([
    getRelatedCompaniesByName(client, project.developerCompany),
    getSeiaRecordForProject(client, id),
    getConfirmedPertinenciaForProject(createSupabaseServiceClient(), id),
    isAdmin(),
    getCurrentUserProfile(client),
    getLatestPgpProgress(client, id),
    getCodSlippageCalibration(createSupabaseServiceClient(), project.developerCompanyId),
  ]);
  const pgpReading = pgpProgress ? interpretPgpProgress(pgpProgress.progressPercent) : null;
  const constructionStartGap = hasConstructionStartGap(project.status, pgpProgress?.progressPercent ?? null);
  const pgpTimelineMilestones: PgpTimelineMilestone[] = pgpProgress
    ? [
        pgpProgress.serviceEstimateDate
          ? { label: locale === "en" ? "Entry into Service" : "Puesta en Servicio", date: pgpProgress.serviceEstimateDate }
          : null,
        pgpProgress.operativeEstimateDate
          ? { label: locale === "en" ? "Commercial Operation" : "Entrada en Operación", date: pgpProgress.operativeEstimateDate }
          : null,
      ].filter((milestone): milestone is PgpTimelineMilestone => milestone !== null)
    : [];
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
    : await getRelatedPortfolioProjects(createSupabaseServiceClient(), {
        id: project.id,
        developerCompanyId: project.developerCompanyId,
        developerCompanyName: project.developerCompany,
        relatedCompanyNames: relatedCompanies?.relatedNames,
      });
  const canInteract = admin || !isFree;
  const followed = canInteract ? await isProjectFollowed(createSupabaseServiceClient(), id) : false;
  const alreadyInCrm = canInteract ? (await getActiveOpportunityProjectIds(admin ? createSupabaseServiceClient() : client, [id])).has(id) : false;
  const ownershipMap = project.verifiedAt
    ? await getProjectOwnershipMap(createSupabaseServiceClient(), project.id)
    : null;

  // Nudges the COD used for the backward schedule calculation using observed
  // slippage for this developer (or the sector, with enough samples) — see
  // lib/analytics/scheduleCalibration.ts. projectPhaseDurations.ts itself is
  // never touched; this only shifts which date the model counts back from.
  const adjustedConnectionDate = scheduleCalibration && project.estimatedConnectionDate
    ? new Date(new Date(project.estimatedConnectionDate).getTime() + scheduleCalibration.codSlippageDaysAvg * 86_400_000)
        .toISOString()
        .slice(0, 10)
    : project.estimatedConnectionDate;
  const estimatedPhase = computeEstimatedPhase(
    adjustedConnectionDate,
    project.technologyCode,
    project.includesStorage,
    project.capacityMw,
  );
  // Where the real (PGP) progress percent would fall if plotted on the same
  // theoretical date axis — lets the timeline show "how far behind" as a
  // calendar gap, not just a percentage gap.
  const constructionPhaseStart = estimatedPhase?.milestones.find((milestone) => milestone.phase === "construccion")?.estimatedStartDate ?? null;
  const realProgressDate = pgpProgress && constructionPhaseStart && adjustedConnectionDate
    ? dateForExpectedProgress(constructionPhaseStart, adjustedConnectionDate, pgpProgress.progressPercent)
    : null;
  const health = computeHealthScore(project.status, seiaRecord?.status ?? null, project.estimatedConnectionDate, new Date(), {
    projectKind: project.projectKind,
    includesStorage: project.includesStorage,
    seiaSubmissionType: seiaRecord?.submissionType,
    pgpProgressPercent: pgpProgress?.progressPercent ?? null,
    pgpDeviationPp: pgpProgress?.deviationPp ?? null,
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
  const renewableCapacityMw = project.generationCapacityMw ??
    (project.projectKind === "generation" || (project.includesStorage && project.technologyCode !== "bess") ? project.capacityMw : null);
  const generationType = project.technologyCode === "solar_pv"
    ? locale === "en" ? "solar generation" : "generación solar"
    : project.technologyCode === "wind"
      ? locale === "en" ? "wind generation" : "generación eólica"
      : project.technologyCode === "hydro" || project.technologyCode === "pumped_hydro"
        ? locale === "en" ? "hydroelectric generation" : "generación hidroeléctrica"
        : locale === "en" ? "renewable generation" : "generación renovable";
  const hasRenewableComponent = project.technologyCode !== "bess" && project.projectKind !== "storage";
  const generationDescription = hasRenewableComponent
    ? renewableCapacityMw !== null
      ? locale === "en" ? `${generationType} with ${renewableCapacityMw} MW of installed capacity` : `${generationType} con ${renewableCapacityMw} MW de potencia instalada`
      : locale === "en" ? "a generation component whose installed capacity has not been reported" : "un componente de generación cuya potencia instalada no ha sido informada"
    : null;
  const bessParts = [
    project.storageCapacityMw !== null ? `${project.storageCapacityMw} MW` : null,
    project.capacityMwh !== null ? `${project.capacityMwh} MWh` : null,
  ].filter(Boolean).join(" / ");
  const storageDescription = project.includesStorage || project.storageCapacityMw !== null || project.capacityMwh !== null
    ? locale === "en" ? `a BESS system${bessParts ? ` rated at ${bessParts}` : " with capacity pending confirmation"}` : `un sistema BESS${bessParts ? ` de ${bessParts}` : " cuya capacidad está pendiente de confirmación"}`
    : null;
  const technicalDescription = [generationDescription, storageDescription].filter(Boolean).join(locale === "en" ? " and " : " y ") || (locale === "en" ? "an energy configuration pending details" : "una configuración energética pendiente de detalle");
  const connection = project.connectionPoint || (locale === "en" ? "a connection point not yet reported" : "un punto de conexión aún no informado");
  const regionName = project.region?.replace(/^Región\s+(?:de(?:l| la)?\s+)?/i, "") || (locale === "en" ? "an unspecified region" : "una región no informada");
  const locality = project.comuna ? (locale === "en" ? `, in the municipality of ${project.comuna}` : `, en la comuna de ${project.comuna}`) : "";
  const projectType = project.technologyCode === "bess" || project.projectKind === "storage"
    ? "BESS"
    : project.includesStorage
      ? project.technologyCode === "solar_pv"
        ? locale === "en" ? "solar hybrid with BESS" : "híbrido solar con BESS"
        : project.technologyCode === "wind"
          ? locale === "en" ? "wind hybrid with BESS" : "híbrido eólico con BESS"
          : locale === "en" ? "renewable hybrid with BESS" : "híbrido renovable con BESS"
      : project.technologyCode === "solar_pv"
        ? "solar"
        : project.technologyCode === "wind"
          ? locale === "en" ? "wind" : "eólico"
          : project.technologyCode === "hydro" || project.technologyCode === "pumped_hydro"
            ? locale === "en" ? "hydroelectric" : "hidroeléctrico"
            : locale === "en" ? "renewable energy" : "de energía renovable";
  const descriptionStart = locale === "en"
    ? `${project.name} is a ${projectType} project located in the ${regionName} region${locality}`
    : `${project.name} es un proyecto ${projectType} ubicado en la región de ${regionName}${locality}`;
  const descriptionVariants = locale === "en"
    ? [
        `${descriptionStart}, considering ${technicalDescription}. Its declared grid connection is at ${connection}.`,
        `${descriptionStart}. Its technical configuration considers ${technicalDescription}, with a declared connection at ${connection}.`,
        `${descriptionStart}, incorporating ${technicalDescription} and identifying ${connection} as its declared connection point.`,
        `${descriptionStart}. According to the available record, it considers ${technicalDescription} and would connect at ${connection}.`,
      ]
    : [
        `${descriptionStart}, que considera ${technicalDescription}. Su conexión declarada al sistema corresponde a ${connection}.`,
        `${descriptionStart}. Su configuración técnica considera ${technicalDescription}, con conexión declarada en ${connection}.`,
        `${descriptionStart}, que incorpora ${technicalDescription} e identifica ${connection} como punto de conexión declarado.`,
        `${descriptionStart}. Según el registro disponible, considera ${technicalDescription} y se conectaría en ${connection}.`,
      ];
  const descriptionIndex = [...project.id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % descriptionVariants.length;
  const projectDescription = descriptionVariants[descriptionIndex];

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
            <FollowButton projectId={project.id} initiallyFollowed={followed} locked={isFree} locale={locale} />
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
          <Field label={locale === "en" ? "Location" : "Ubicación"} value={[project.comuna, project.region].filter(Boolean).join(", ") || null} />
          <Field label="RUT" value={formatRutForDisplay(project.developerCompanyRut)} locked={isFree} />
          <Field label={locale === "en" ? "Registered address" : "Dirección legal"} value={project.developerCompanyAddress} locked={isFree} />
          <Field label={locale === "en" ? "SPV/Owner" : "SPV/Propietario"} value={project.spv} locked={isFree} />
          <Field label={locale === "en" ? "Technology" : "Tecnología"} value={technologyLabel} />
          <Field
            label={locale === "en" ? "Installed capacity" : "Potencia instalada"}
            value={!hasRenewableComponent ? "N/A" : renewableCapacityMw !== null ? `${renewableCapacityMw} MW` : null}
          />
          <Field
            label={locale === "en" ? "BESS capacity" : "Potencia BESS"}
            value={!project.includesStorage ? "N/A" : project.storageCapacityMw !== null ? `${project.storageCapacityMw} MW` : null}
          />
          <Field
            label={locale === "en" ? "BESS energy" : "Energía BESS"}
            value={!project.includesStorage ? "N/A" : project.capacityMwh !== null ? `${project.capacityMwh} MWh` : null}
          />
          <Field
            label={locale === "en" ? "BESS duration" : "Duración BESS"}
            value={!project.includesStorage ? "N/A" : project.storageHours !== null ? `${project.storageHours} h` : null}
          />
          <Field label={locale === "en" ? "Connection point" : "Punto de conexión"} value={project.connectionPoint} />
          <Field label={locale === "en" ? "Voltage level" : "Nivel de tensión"} value={project.voltageLevel ? `${project.voltageLevel} kV` : null} />
          <Field
            label={locale === "en" ? "Project connection date (declared)" : "Fecha de conexión del proyecto (declarada)"}
            value={project.estimatedConnectionDate ? new Date(project.estimatedConnectionDate).toLocaleDateString(locale === "en" ? "en-GB" : "es-CL") : null}
          />
        </dl>
      </div>

      <section className="border-b border-neutral-100 pb-8 dark:border-neutral-900" aria-labelledby="project-description-title">
        <div className="flex items-center gap-1.5">
          <h2 id="project-description-title" className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            {locale === "en" ? "Description" : "Descripción"}
          </h2>
          <InfoTooltip
            text={locale === "en" ? "Automatically generated summary based on the project's technical and location data." : "Resumen generado automáticamente a partir de los datos técnicos y de ubicación del proyecto."}
            locale={locale}
          />
        </div>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">{projectDescription}</p>
      </section>

      {synthesis && (
        <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900">
          <SectionLabel
            info={locale === "en" ? "Our own estimate of what stage the project should be at today, based on its declared connection date." : "Estimación propia de en qué etapa debería estar el proyecto hoy, según su fecha de conexión declarada."}
            locale={locale}
          >
            {locale === "en" ? "Theoretical project status" : "Estado teórico del Proyecto"}
          </SectionLabel>
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
          <SectionLabel
            info={locale === "en" ? "Our own score (0–100) combining connection permitting progress and SEIA environmental progress; not an official figure." : "Puntaje propio (0–100) que combina el avance del trámite de conexión y el avance ambiental SEIA; no es un dato oficial."}
            locale={locale}
          >
            Health Score
          </SectionLabel>
          <PlanGate locked={isFree}>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <HealthScoreBadge health={health} />
              <div className="max-w-xl text-xs text-neutral-500 dark:text-neutral-400">
                <p>
                  {locale === "en" ? "Transition LATAM assessment combining project progress; this is not official data. It weighs connection progress" : "Lectura propia combinada del avance del proyecto — no es un dato oficial. Pondera el avance del trámite de conexión"}
                  {health.seiaScore !== null
                    ? locale === "en" ? " (60%) and SEIA environmental progress (40%)" : " (60%) y del trámite ambiental SEIA (40%)"
                    : locale === "en" ? " (100%, with no linked SEIA filing)" : " (100%, sin expediente SEIA asociado)"}
                  {health.overdueReason === "fecha_pasada"
                    ? locale === "en" ? "; penalized because the estimated connection date has passed without reaching construction" : "; penalizado porque la fecha estimada de conexión ya pasó sin llegar a construcción"
                    : health.overdueReason === "pgp_estancado"
                      ? locale === "en" ? "; penalized because PGP shows the project stalled well behind its own theoretical schedule" : "; penalizado porque el PGP muestra al proyecto estancado, muy por detrás de su propio cronograma teórico"
                      : ""}
                  .
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  <li>
                    {locale === "en" ? "Connection progress:" : "Avance de conexión:"}{" "}
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">
                      {health.statusScore !== null ? `${health.statusScore}/100` : locale === "en" ? "not calculable" : "no calculable"}
                    </span>
                  </li>
                  <li>
                    {locale === "en" ? "Environmental progress:" : "Avance ambiental:"}{" "}
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">
                      {health.seiaScore !== null ? `${health.seiaScore}/100` : locale === "en" ? "not calculable" : "no calculable"}
                    </span>
                    {" — "}
                    {health.environmentalNote}
                  </li>
                  {health.overdue && (
                    <li className="text-amber-700 dark:text-amber-400">
                      {health.overdueReason === "pgp_estancado"
                        ? locale === "en" ? "Overdue penalty: −20 points (PGP shows the project stalled behind schedule)" : "Penalización por atraso: −20 puntos (el PGP muestra al proyecto estancado, detrás de su cronograma)"
                        : locale === "en" ? "Overdue penalty: −20 points (estimated connection date already passed)" : "Penalización por atraso: −20 puntos (la fecha estimada de conexión ya pasó)"}
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </PlanGate>
        </section>
      )}

      {pgpProgress && pgpReading && (
        <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900">
          <SectionLabel
            info={locale === "en" ? "Physical construction progress officially reported in the National Electricity Coordinator's Major Projects Program (PGP)." : "Porcentaje de avance físico de obra reportado oficialmente en el Programa de Grandes Proyectos (PGP) del Coordinador Eléctrico Nacional."}
            locale={locale}
          >
            {locale === "en" ? "Reported physical construction" : "Construcción física reportada"}
          </SectionLabel>
          <PlanGate locked={isFree}>
            <div className="mt-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-semibold text-neutral-950 dark:text-white">{pgpReading.percent}%</p>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{pgpReading.label}</p>
                </div>
                <a className="text-xs font-medium text-brand-deep underline" href={pgpProgress.sourceUrl} target="_blank" rel="noreferrer">
                  PGP · NUP {pgpProgress.nup}
                </a>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                <div className="h-full rounded-full bg-brand-primary" style={{ width: `${pgpReading.percent}%` }} />
              </div>
              {pgpProgress.expectedProgressPercent !== null && pgpProgress.deviationPp !== null && (
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:max-w-md">
                  <div className="rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
                    <p className="text-neutral-500">{locale === "en" ? "Expected progress" : "Avance esperado"}</p>
                    <p className="mt-1 font-semibold text-neutral-900 dark:text-white">{pgpProgress.expectedProgressPercent}%</p>
                  </div>
                  <div className="rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
                    <p className="text-neutral-500">{locale === "en" ? "Schedule deviation" : "Desviación de cronograma"}</p>
                    <p className={`mt-1 font-semibold ${pgpProgress.deviationPp < -10 ? "text-amber-700 dark:text-amber-400" : "text-neutral-900 dark:text-white"}`}>
                      {pgpProgress.deviationPp > 0 ? "+" : ""}{pgpProgress.deviationPp} pp
                    </p>
                  </div>
                </div>
              )}
              {(pgpProgress.serviceEstimateDate || pgpProgress.operativeEstimateDate) && (
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:max-w-md">
                  <div className="rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
                    <p className="text-neutral-500">{locale === "en" ? "Entry into Service" : "Puesta en Servicio"}</p>
                    <p className="mt-1 font-semibold text-neutral-900 dark:text-white">
                      {locale === "en" ? "Estimated" : "Estimada"}:{" "}
                      {pgpProgress.serviceEstimateDate ? new Date(pgpProgress.serviceEstimateDate).toLocaleDateString(locale === "en" ? "en-GB" : "es-CL") : "—"}
                    </p>
                    <p className="mt-0.5 text-neutral-500">{locale === "en" ? "Actual" : "Real"}: —</p>
                  </div>
                  <div className="rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
                    <p className="text-neutral-500">{locale === "en" ? "Commercial Operation" : "Entrada en Operación"}</p>
                    <p className="mt-1 font-semibold text-neutral-900 dark:text-white">
                      {locale === "en" ? "Estimated" : "Estimada"}:{" "}
                      {pgpProgress.operativeEstimateDate ? new Date(pgpProgress.operativeEstimateDate).toLocaleDateString(locale === "en" ? "en-GB" : "es-CL") : "—"}
                    </p>
                    <p className="mt-0.5 text-neutral-500">{locale === "en" ? "Actual" : "Real"}: —</p>
                  </div>
                </div>
              )}
              {constructionStartGap && (
                <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-400">
                  {locale === "en"
                    ? "Connection processing is complete, but PGP reports 0% physical progress. The start of works is not evidenced by this source."
                    : "La tramitación de conexión está completa, pero PGP reporta 0% de avance físico. Esta fuente no evidencia inicio de obras."}
                </p>
              )}
              <p className="mt-2 text-[11px] text-neutral-400">
                {locale === "en" ? "Official PGP reading observed on" : "Lectura oficial PGP observada el"} {new Date(pgpProgress.observedAt).toLocaleDateString(locale === "en" ? "en-GB" : "es-CL")}.
              </p>
            </div>
          </PlanGate>
        </section>
      )}

      <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900">
        <SectionLabel
          info={locale === "en" ? "Current status of the grid connection process and, if applicable, the environmental process (SEIA/Pertinencia)." : "Estado actual del trámite de conexión al sistema eléctrico y, si aplica, del trámite ambiental (SEIA/Pertinencia)."}
          locale={locale}
        >
          {locale === "en" ? "Permitting progress" : "Avance de tramitación"}
        </SectionLabel>
        <div className="mt-3">
          <PlanGate locked={isFree}>
            <ProjectProcessProgress
              connectionStatus={project.status}
              environmentalStatus={seiaRecord?.status ?? null}
              pertinencia={confirmedPertinencia ? { estado: confirmedPertinencia.estado, subEstado: confirmedPertinencia.subEstado } : null}
              locale={locale}
            />
          </PlanGate>
        </div>
      </section>

      {estimatedPhase && (
        <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900">
          <SectionLabel
            info={locale === "en" ? "Probabilistic model that works backward from the estimated connection date to place the project in a typical market development stage." : "Modelo probabilístico que calcula hacia atrás desde la fecha de conexión estimada para ubicar al proyecto en una etapa de desarrollo típica de mercado."}
            locale={locale}
          >
            {locale === "en" ? "Estimated development stage" : "Etapa estimada de desarrollo"}
          </SectionLabel>
          <PlanGate locked={isFree}>
            <div className="mt-3 flex items-center gap-2">
              <span className="rounded-full bg-brand-surface px-2 py-0.5 text-xs font-medium text-brand-deep">
                {locale === "en" ? "Estimated" : "Estimado"} ·{" "}
                {estimatedPhase.groupLabel === "PMGD" ? `PMGD · ${technologyLabel}` : estimatedPhase.groupLabel}
              </span>
            </div>
            {scheduleCalibration && (
              <p className="mt-2 text-[11px] text-neutral-400">
                {locale === "en"
                  ? `Schedule shifted ${scheduleCalibration.codSlippageDaysAvg > 0 ? "+" : ""}${Math.round(scheduleCalibration.codSlippageDaysAvg)} days based on observed connection-date changes for ${scheduleCalibration.scope === "developer" ? "this developer" : "the sector"} (n=${scheduleCalibration.sampleSize}).`
                  : `Cronograma ajustado ${scheduleCalibration.codSlippageDaysAvg > 0 ? "+" : ""}${Math.round(scheduleCalibration.codSlippageDaysAvg)} días según el historial de cambios de fecha de conexión de ${scheduleCalibration.scope === "developer" ? "esta empresa" : "el sector"} (n=${scheduleCalibration.sampleSize}).`}
              </p>
            )}
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
            <PhaseTimeline
              milestones={estimatedPhase.milestones}
              connectionDate={adjustedConnectionDate!}
              pgpMilestones={pgpTimelineMilestones}
              constructionProgress={
                pgpProgress && pgpProgress.expectedProgressPercent !== null
                  ? { theoreticalPercent: pgpProgress.expectedProgressPercent, realPercent: pgpProgress.progressPercent }
                  : undefined
              }
              realProgressDate={realProgressDate ?? undefined}
              locale={locale}
            />
          </PlanGate>
        </section>
      )}

      <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900">
        <SectionLabel
          info={locale === "en" ? "Contact details for people linked to the project or the developer company." : "Datos de contacto de las personas vinculadas al proyecto o a la empresa desarrolladora."}
          locale={locale}
        >
          {locale === "en" ? "Contact" : "Contacto"}
        </SectionLabel>
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
          <SectionLabel
            info={locale === "en" ? "Status of the project's environmental filing with the SEIA, including pertinencia filings when applicable." : "Estado del expediente ambiental del proyecto en el SEIA, incluyendo pertinencias cuando corresponde."}
            locale={locale}
          >
            {locale === "en" ? "Environmental status" : "Estado ambiental"}
          </SectionLabel>
          {admin && (
            <div className="flex items-center gap-3">
              <SeiaMatchModal
                projectId={project.id}
                projectName={project.name}
                hasExistingMatch={!!seiaRecord}
                isAdmin
              />
              <PertinenciaMatchModal
                projectId={project.id}
                projectName={project.name}
                hasExistingMatch={!!confirmedPertinencia}
                isAdmin
              />
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-col gap-4">
          <PlanGate locked={isFree}>
            {seiaRecord ? (
              <SeiaStatusCard record={seiaRecord} locale={locale} />
            ) : (
              <div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">{locale === "en" ? "No associated records." : "Sin antecedentes asociados."}</p>
              </div>
            )}
            {confirmedPertinencia && <PertinenciaStatusCard record={confirmedPertinencia} locale={locale} />}
          </PlanGate>
        </div>
      </section>

      {relatedCompanies && (
        <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900">
          <div className="flex items-center gap-2">
            <SectionLabel
              info={locale === "en" ? "Other companies the National Electricity Coordinator groups with the developer under the same corporate group." : "Otras empresas que el Coordinador Eléctrico Nacional agrupa junto al desarrollador bajo el mismo grupo corporativo."}
              locale={locale}
            >
              {locale === "en" ? "Related companies" : "Empresas relacionadas"}
            </SectionLabel>
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

      {project.verifiedAt && (
        <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900" aria-labelledby="ownership-title">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="ownership-title" className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              {locale === "en" ? "Ownership" : "Propiedad"}
            </h2>
            {ownershipMap && (
              <span className="rounded-full bg-brand-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-deep">Prime</span>
            )}
            <InfoTooltip
              text={locale === "en" ? "Manually verified corporate chain: who owns the project's SPV and who the ultimate controller is." : "Cadena societaria verificada manualmente: quién es dueño de la SPV del proyecto y quién controla en última instancia."}
              locale={locale}
            />
          </div>
          <p className="mt-2 mb-4 max-w-3xl text-sm text-neutral-600 dark:text-neutral-400">
            {locale === "en"
              ? "Direct owners, intermediate companies and ultimate controllers linked to the project SPV."
              : "Propietarios directos, sociedades intermedias y controladores finales vinculados a la SPV del proyecto."}
          </p>
          <ProjectOwnershipSection map={ownershipMap} projectName={project.name} locked={isFree} locale={locale} />
        </section>
      )}

      <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900">
        <SectionLabel
          info={locale === "en" ? "Other active projects linked by the same RUT, SPV, corporate group, or shared corporate contacts." : "Otros proyectos activos vinculados por mismo RUT, SPV, grupo empresarial o contactos corporativos compartidos."}
          locale={locale}
        >
          {locale === "en" ? "Related projects" : "Proyectos relacionados"}
        </SectionLabel>
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
          {locale === "en"
            ? "Other verified active projects linked through the same RUT, SPV, corporate group or at least two shared corporate contacts, with their estimated development stage."
            : "Otros proyectos activos verificados vinculados por el mismo RUT, SPV, grupo empresarial o al menos dos contactos corporativos compartidos, junto con su etapa estimada de desarrollo."}
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

    </div>
  );
}
