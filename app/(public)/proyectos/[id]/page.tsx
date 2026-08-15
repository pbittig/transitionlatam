import { formatDateOnly } from "@/lib/shared/formatDateOnly";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getProjectById, getRelatedPortfolioProjects, getProjectStakeholders, getProjectTimeline } from "@/lib/data-access/projects";
import { computeProjectPulse, formatMonthSpan, formatTimeAgo } from "@/lib/shared/projectPulse";
import { maskName, maskEmail } from "@/lib/shared/maskContact";
import { getRelatedCompaniesByName } from "@/lib/data-access/coordinadorEmpresas";
import { getSeiaRecordForProject } from "@/lib/data-access/seia";
import { isConfirmedSeiaMatch } from "@/lib/shared/seiaMatchTrust";
import { isProjectFollowed } from "@/lib/data-access/watchlist";
import { logProjectView } from "@/lib/data-access/behaviorEvent";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { isAdmin } from "@/lib/auth/session";
import { computeHealthScore } from "@/lib/shared/projectHealthScore";
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
import { ProjectTechnologyIcon } from "../../components/ProjectTable";
import { PlanGate } from "../../components/PlanGate";
import { getAppLocale, type AppLocale } from "@/lib/i18n";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";
import { ShareProjectButton } from "./ShareProjectButton";
import { InfoTooltip } from "../../components/InfoTooltip";
import { getProjectOwnershipMap } from "@/lib/data-access/projectOwnership";
import { ProjectOwnershipSection } from "./ProjectOwnershipSection";
import { getLatestPgpProgress } from "@/lib/data-access/pgpProgress";
import { getConstructionDeclarationForProject } from "@/lib/data-access/construction";
import { hasConstructionStartGap, interpretPgpProgress } from "@/lib/shared/pgpProjectProgress";
import { normalizeForMatch } from "@/lib/ingestion/sources/energia-abierta/listado/normalize";
import { FEHACIENTE_AWAITING_SUCTD_MARKER } from "@/lib/ingestion/sources/energia-abierta/listado/load";

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

  // isAdmin() se resuelve antes del resto porque decide con qué cliente se lee
  // el avance PGP: `latest_pgp_project_progress` es una vista security_invoker
  // cuya policy exige el rol `authenticated`, y una sesión de admin es un JWT
  // propio (cookie `session`), que para Supabase es anónimo. Leyéndola con el
  // cliente de usuario, un admin recibía cero filas y la ficha mostraba "sin
  // registro en PGP" para proyectos que sí tienen avance informado. Mismo
  // criterio que ya usan la propiedad, la pertinencia y el CRM en esta página.
  const admin = await isAdmin();
  const [relatedCompanies, seiaRecord, confirmedPertinencia, profile, pgpProgress, timeline, cneDeclaration] = await Promise.all([
    getRelatedCompaniesByName(client, project.developerCompany),
    getSeiaRecordForProject(client, id),
    getConfirmedPertinenciaForProject(createSupabaseServiceClient(), id),
    getCurrentUserProfile(client),
    getLatestPgpProgress(admin ? createSupabaseServiceClient() : client, id),
    getProjectTimeline(client, id),
    getConstructionDeclarationForProject(client, id),
  ]);
  const pulse = computeProjectPulse(timeline);
  // Un match automático de confianza baja no es antecedente ambiental: se sigue
  // mostrando como candidato (y en admin, para poder corregirlo) pero no entra
  // en el estado ambiental ni en el Health Score — ver
  // lib/shared/seiaMatchTrust.ts.
  const seiaConfirmed = isConfirmedSeiaMatch(seiaRecord);
  const confirmedSeiaRecord = seiaConfirmed ? seiaRecord : null;
  const pgpReading = pgpProgress ? interpretPgpProgress(pgpProgress.progressPercent) : null;
  const constructionStartGap = hasConstructionStartGap(project.status, pgpProgress?.progressPercent ?? null);
  const showSuctdSearch = admin && !!project.status && normalizeForMatch(project.status).includes(normalizeForMatch(FEHACIENTE_AWAITING_SUCTD_MARKER));
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

  const health = computeHealthScore(project.status, confirmedSeiaRecord?.status ?? null, project.estimatedConnectionDate, new Date(), {
    projectKind: project.projectKind,
    includesStorage: project.includesStorage,
    seiaSubmissionType: confirmedSeiaRecord?.submissionType,
    generationCapacityMw: project.generationCapacityMw ?? project.capacityMw,
    voltageLevel: project.voltageLevel,
  });

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
  // La descripción del expediente PGP la escribió el titular y dice cosas que
  // ninguna plantilla nuestra puede decir (obras asociadas, estructuras donde
  // secciona la línea, tensión de evacuación). Cuando existe, gana: la plantilla
  // queda de reserva para los ~1.900 proyectos que no están en PGP.
  const projectDescription = pgpProgress?.description?.trim() || descriptionVariants[descriptionIndex];
  const descriptionFromSource = !!pgpProgress?.description?.trim();

  // Dos fechas del mismo titular a la misma autoridad que no coinciden: la
  // conexión que declaró en Acceso Abierto y la operación que estima en PGP.
  // Sólo se muestra cuando la brecha es material (>90 días) — un desfase menor
  // es ruido de planificación, no una señal.
  const codVsPgpDays =
    project.estimatedConnectionDate && pgpProgress?.operativeEstimateDate
      ? Math.round(
          (new Date(pgpProgress.operativeEstimateDate).getTime() - new Date(project.estimatedConnectionDate).getTime()) / 86_400_000,
        )
      : null;
  const scheduleConflict = codVsPgpDays !== null && Math.abs(codVsPgpDays) > 90 ? codVsPgpDays : null;

  const environmentalDetailExtra = (seiaRecord || confirmedPertinencia || admin) && (
    <div className="mt-3 flex flex-col gap-4">
      {seiaRecord && <SeiaStatusCard record={seiaRecord} confirmed={seiaConfirmed} locale={locale} />}
      {confirmedPertinencia && <PertinenciaStatusCard record={confirmedPertinencia} locale={locale} />}
      {admin && (
        <div className="flex items-center gap-3">
          <SeiaMatchModal projectId={project.id} projectName={project.name} hasExistingMatch={!!seiaRecord} isAdmin />
          <PertinenciaMatchModal projectId={project.id} projectName={project.name} hasExistingMatch={!!confirmedPertinencia} isAdmin />
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-12">
      <div className="border-b border-neutral-100 pb-8 dark:border-neutral-900">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <ProjectTechnologyIcon project={project} locale={locale} />
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl dark:text-neutral-50">
                {project.name}
              </h1>
            </div>
            <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-500">{project.internalCode}</p>
            {(pulse.requestAgeMonths !== null || pulse.lastMovement) && (
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                {pulse.requestAgeMonths !== null && (
                  <span>
                    {locale === "en" ? "Application filed" : "Solicitud ingresada"}{" "}
                    <strong className="font-semibold text-neutral-700 dark:text-neutral-200">
                      {locale === "en"
                        ? `${formatMonthSpan(pulse.requestAgeMonths, "en")} ago`
                        : `hace ${formatMonthSpan(pulse.requestAgeMonths, "es")}`}
                    </strong>
                  </span>
                )}
                {pulse.requestAgeMonths !== null && pulse.lastMovement && <span aria-hidden>·</span>}
                {pulse.lastMovement ? (
                  <span>
                    {locale === "en" ? "last movement" : "último movimiento"}{" "}
                    <strong className="font-semibold text-neutral-700 dark:text-neutral-200">
                      {formatTimeAgo(pulse.lastMovement.occurredAt, locale === "en" ? "en" : "es")}
                    </strong>
                    {pulse.lastMovement.description && (
                      <span className="text-neutral-400 dark:text-neutral-500"> — {pulse.lastMovement.description}</span>
                    )}
                  </span>
                ) : (
                  <span className="text-neutral-400 dark:text-neutral-500">
                    {locale === "en"
                      ? "no movement observed since we started tracking it"
                      : "sin movimientos observados desde que lo seguimos"}
                  </span>
                )}
              </p>
            )}
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
          <Field label={locale === "en" ? "Substation bay" : "Paño"} value={project.substationBay} />
          <Field label={locale === "en" ? "Transmission segment" : "Segmento de transmisión"} value={project.transmissionSegment} />
          <Field
            label={locale === "en" ? "Project connection date (declared)" : "Fecha de conexión del proyecto (declarada)"}
            value={formatDateOnly(project.estimatedConnectionDate, locale === "en" ? "en" : "es")}
          />
        </dl>
        {scheduleConflict !== null && (
          <p className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <span className="font-semibold">
              {scheduleConflict > 0
                ? locale === "en"
                  ? `Sources disagree by ${scheduleConflict} days`
                  : `Las fuentes difieren en ${scheduleConflict} días`
                : locale === "en"
                  ? `Sources disagree by ${Math.abs(scheduleConflict)} days`
                  : `Las fuentes difieren en ${Math.abs(scheduleConflict)} días`}
            </span>
            <span>
              {locale === "en"
                ? `The owner reports this connection date to the Coordinator, but estimates commercial operation on ${new Date(pgpProgress!.operativeEstimateDate!).toLocaleDateString("en-GB")} in the PGP.`
                : `El titular declara esta fecha de conexión al Coordinador, pero en el PGP estima entrar en operación el ${new Date(pgpProgress!.operativeEstimateDate!).toLocaleDateString("es-CL")}.`}
            </span>
          </p>
        )}
      </div>

      <section className="border-b border-neutral-100 pb-8 dark:border-neutral-900" aria-labelledby="project-description-title">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 id="project-description-title" className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                {locale === "en" ? "Description" : "Descripción"}
              </h2>
              <InfoTooltip
                text={
                  descriptionFromSource
                    ? locale === "en"
                      ? "Description as filed by the owner in the Coordinator's Project Management Platform (PGP). Not written by us."
                      : "Descripción tal como el titular la presentó en la Plataforma de Gestión de Proyectos (PGP) del Coordinador. No la redactamos nosotros."
                    : locale === "en"
                      ? "Automatically generated summary based on the project's technical and location data."
                      : "Resumen generado automáticamente a partir de los datos técnicos y de ubicación del proyecto."
                }
                locale={locale}
              />
            </div>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">{projectDescription}</p>
          </div>
          {health.score !== null && (
            <PlanGate locked={isFree}>
              <div className="shrink-0 sm:border-l sm:border-neutral-100 sm:pl-6 dark:sm:border-neutral-900">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Health Score</span>
                  <InfoTooltip
                    text={locale === "en" ? "Our own score (0–100) combining connection permitting progress and SEIA environmental progress; not an official figure." : "Puntaje propio (0–100) que combina el avance del trámite de conexión y el avance ambiental SEIA; no es un dato oficial."}
                    locale={locale}
                  />
                </div>
                <div className="mt-1.5">
                  <HealthScoreBadge health={health} />
                </div>
                <p className="mt-1.5 max-w-[220px] text-[11px] text-neutral-500 dark:text-neutral-400">
                  {health.seiaScore !== null
                    ? locale === "en" ? "60% connection / 40% environmental" : "60% conexión / 40% ambiental"
                    : locale === "en" ? "100%, no linked SEIA filing" : "100%, sin expediente SEIA asociado"}
                  {health.overdue && (locale === "en" ? " · penalized (past connection date)" : " · penalizado (fecha de conexión ya pasó)")}
                </p>
              </div>
            </PlanGate>
          )}
        </div>
      </section>

      <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900">
        <SectionLabel
          info={locale === "en" ? "Connection permitting progress, environmental progress and physical construction progress reported in the PGP, with source detail per bar." : "Avance del trámite de conexión, avance ambiental y avance físico de construcción reportado en el PGP, con detalle de la fuente en cada barra."}
          locale={locale}
        >
          {locale === "en" ? "Project progress" : "Avance de proyecto"}
        </SectionLabel>
        <div className="mt-3">
          <PlanGate locked={isFree}>
            <ProjectProcessProgress
              projectId={project.id}
              connectionStatus={project.status}
              externalReference={project.externalReference}
              environmentalStatus={confirmedSeiaRecord?.status ?? null}
              seiaUrlFicha={confirmedSeiaRecord?.urlFicha}
              unconfirmedSeiaCandidate={!seiaConfirmed && !!seiaRecord}
              cneDeclaration={cneDeclaration}
              pertinencia={confirmedPertinencia ? { estado: confirmedPertinencia.estado, subEstado: confirmedPertinencia.subEstado } : null}
              pertinenciaDocUrl={confirmedPertinencia?.documentos[0]?.url ?? null}
              pgpProgress={pgpProgress}
              pgpReading={pgpReading}
              constructionStartGap={constructionStartGap}
              environmentalDetailExtra={environmentalDetailExtra}
              showSuctdSearch={showSuctdSearch}
              locale={locale}
            />
          </PlanGate>
        </div>
      </section>

      <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900">
        <SectionLabel
          info={locale === "en" ? "Contact details for people linked to the project or the developer company." : "Datos de contacto de las personas vinculadas al proyecto o a la empresa desarrolladora."}
          locale={locale}
        >
          {locale === "en" ? "Contact (related executives)" : "Contacto (Ejecutivos relacionados)"}
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
