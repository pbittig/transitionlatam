import { formatDateOnly } from "@/lib/shared/formatDateOnly";
import { getSeiaMaturity, isSeiaNegativeTerminal } from "@/lib/shared/seiaStatusMaturity";
import { getStatusMaturity, isRejectedStatus } from "@/lib/shared/projectStatusMaturity";
import { getPertinenciaMaturity, isPertinenciaNegativeTerminal } from "@/lib/shared/pertinenciaStatusMaturity";
import { clasificarConclusionPertinencia } from "@/lib/data-access/pertinencias";
import type { LatestPgpProgress } from "@/lib/data-access/pgpProgress";
import type { ConstructionDeclaration } from "@/lib/data-access/construction";
import type { PgpProgressReading } from "@/lib/shared/pgpProjectProgress";
import type { AppLocale } from "@/lib/i18n";
import { ExpandableProgressBar } from "./ExpandableProgressBar";
import { FindSuctdSiblingButton } from "./FindSuctdSiblingButton";

const ACCESO_ABIERTO_URL = "https://accesoabierto.coordinador.cl";

export function ProjectProcessProgress({
  projectId,
  connectionStatus,
  externalReference,
  environmentalStatus,
  seiaUrlFicha,
  pertinencia,
  pertinenciaDocUrl,
  pgpProgress,
  pgpReading,
  constructionStartGap,
  environmentalDetailExtra,
  showSuctdSearch,
  unconfirmedSeiaCandidate = false,
  cneDeclaration,
  locale = "es",
}: {
  projectId: string;
  connectionStatus: string | null;
  externalReference?: string | null;
  environmentalStatus: string | null;
  seiaUrlFicha?: string | null;
  /** Hay un expediente candidato que el cruce automático no pudo confirmar — se avisa sin desplegar el detalle. */
  unconfirmedSeiaCandidate?: boolean;
  /** Declaración en Construcción de CNE, si la nómina la trae para este proyecto. */
  cneDeclaration?: ConstructionDeclaration | null;
  pertinencia?: { estado: string | null; subEstado: string | null } | null;
  pertinenciaDocUrl?: string | null;
  pgpProgress?: LatestPgpProgress | null;
  pgpReading?: PgpProgressReading | null;
  constructionStartGap?: boolean;
  environmentalDetailExtra?: React.ReactNode;
  showSuctdSearch?: boolean;
  locale?: AppLocale;
}) {
  const en = locale === "en";
  const connectionMaturity = getStatusMaturity(connectionStatus);
  const connectionTerminal = isRejectedStatus(connectionStatus);

  // El estado del Coordinador y la nómina de CNE son dos autoridades distintas
  // mirando el mismo hecho. Cuando CNE ya declaró el proyecto en construcción y
  // el trámite de conexión todavía no lo refleja, el hito se da por cumplido
  // citando a CNE — un hito no retrocede porque otra fuente aún no lo diga
  // (docs/11 §14, regla R3). El desfase se muestra, no se esconde.
  const declaredByCoordinador = !!connectionStatus && /proyecto declarado en construc/i.test(
    connectionStatus.normalize("NFD").replace(/[̀-ͯ]/g, ""),
  );
  const cneAheadOfCoordinador = !!cneDeclaration && !declaredByCoordinador;

  const connectionDetail = (
    <>
      <p>
        {en
          ? "Status reported in the Open Access connection-request portal of the National Electricity Coordinator."
          : "Estado informado en el portal de Acceso Abierto de solicitudes de conexión del Coordinador Eléctrico Nacional."}
      </p>
      {cneAheadOfCoordinador && (
        <p className="mt-2 font-medium text-amber-700 dark:text-amber-400">
          {en
            ? `The CNE already lists this project as declared under construction (resolution ${cneDeclaration!.resolution ?? cneDeclaration!.currentResolutionNumber}), ahead of the connection status above.`
            : `La CNE ya lo tiene declarado en construcción (resolución ${cneDeclaration!.resolution ?? cneDeclaration!.currentResolutionNumber}), por delante del estado de conexión de arriba.`}
        </p>
      )}
      {externalReference && (
        <p className="mt-1 text-neutral-500">
          {en ? "Request ID" : "ID de solicitud"}: {externalReference}
        </p>
      )}
      <a href={ACCESO_ABIERTO_URL} target="_blank" rel="noreferrer" className="mt-2 inline-block font-medium text-brand-deep underline">
        {en ? "Open Acceso Abierto portal" : "Ver portal Acceso Abierto"}
      </a>
    </>
  );

  let secondBar: { title: string; status: string; percentage: number | null; badgeLabel: string; terminal: boolean; detail: React.ReactNode };
  if (environmentalStatus) {
    const environmentalMaturity = getSeiaMaturity(environmentalStatus);
    const terminal = isSeiaNegativeTerminal(environmentalStatus);
    secondBar = {
      title: en ? "Environmental status" : "Estado ambiental",
      status: environmentalStatus,
      percentage: environmentalMaturity?.order ?? null,
      badgeLabel: terminal ? (en ? "Process ended" : "Proceso terminado") : environmentalMaturity ? `${environmentalMaturity.order}%` : en ? "Progress unavailable" : "Sin avance calculable",
      terminal,
      detail: (
        <>
          <p>{en ? "Environmental filing with the Environmental Assessment Service (SEA/SEIA)." : "Expediente ambiental ante el Servicio de Evaluación Ambiental (SEA/SEIA)."}</p>
          {seiaUrlFicha && (
            <a href={seiaUrlFicha} target="_blank" rel="noreferrer" className="mt-2 inline-block font-medium text-brand-deep underline">
              {en ? "View SEIA filing" : "Ver ficha SEIA"}
            </a>
          )}
          {environmentalDetailExtra}
        </>
      ),
    };
  } else if (pertinencia) {
    const pertinenciaMaturity = getPertinenciaMaturity(pertinencia.estado, pertinencia.subEstado);
    const terminal = isPertinenciaNegativeTerminal(pertinencia.subEstado);
    secondBar = {
      title: en ? "Pertinence consultation (SEA)" : "Consulta de pertinencia (SEA)",
      status: clasificarConclusionPertinencia(pertinencia.estado, pertinencia.subEstado),
      percentage: pertinenciaMaturity?.order ?? null,
      badgeLabel: terminal ? (en ? "Process ended" : "Proceso terminado") : pertinenciaMaturity ? `${pertinenciaMaturity.order}%` : en ? "Progress unavailable" : "Sin avance calculable",
      terminal,
      detail: (
        <>
          <p>{en ? "Pertinence consultation with the Environmental Assessment Service (SEA), prior to a formal SEIA filing." : "Consulta de pertinencia ante el Servicio de Evaluación Ambiental (SEA), previa a un ingreso formal al SEIA."}</p>
          {pertinenciaDocUrl && (
            <a href={pertinenciaDocUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block font-medium text-brand-deep underline">
              {en ? "View SEA document" : "Ver documento SEA"}
            </a>
          )}
          {environmentalDetailExtra}
        </>
      ),
    };
  } else {
    secondBar = {
      title: en ? "Environmental status" : "Estado ambiental",
      status: unconfirmedSeiaCandidate
        ? en
          ? "No confirmed filing — one unconfirmed candidate found"
          : "Sin expediente confirmado — hay un candidato sin confirmar"
        : en
          ? "No SEIA filing linked yet"
          : "Sin expediente SEIA asociado todavía",
      percentage: null,
      badgeLabel: unconfirmedSeiaCandidate
        ? en ? "Unconfirmed link" : "Vínculo sin confirmar"
        : en ? "No linked filing" : "Sin expediente asociado",
      terminal: false,
      detail: (
        <>
          <p>{en ? "No environmental filing has been linked to this project yet." : "Aún no se ha vinculado un expediente ambiental a este proyecto."}</p>
          {environmentalDetailExtra}
        </>
      ),
    };
  }

  // Todas las fechas de este bloque —PGP y nómina de CNE— son columnas `date`,
  // días del calendario y no instantes. Pasarlas por `new Date()` las corría un
  // día hacia atrás en Chile (ver formatDateOnly.ts, mismo bug detectado en el
  // verificador el 2026-08-15).
  const fmt = (value: string | null | undefined) => formatDateOnly(value, en ? "en" : "es");
  // Hitos que el expediente PGP tiene registrados. Se listan aparte de las
  // estimaciones porque no son lo mismo: una fecha registrada es lo que el
  // expediente dice que pasó, una estimada es lo que el titular proyecta.
  const reportedMilestones = pgpProgress
    ? ([
        [en ? "Received in PGP" : "Recepción en PGP", fmt(pgpProgress.receptionDate)],
        [en ? "Construction declaration" : "Declaración en construcción", fmt(pgpProgress.constructionDeclarationDate)],
        [en ? "Entry into Service (recorded)" : "Puesta en Servicio (registrada)", fmt(pgpProgress.serviceDate)],
        [en ? "Commercial Operation (recorded)" : "Entrada en Operación (registrada)", fmt(pgpProgress.operativeDate)],
      ] as const).filter(([, value]) => value !== null)
    : [];

  const cneBlock = cneDeclaration && (
    <div className="mt-2 flex flex-col gap-0.5 border-t border-neutral-200 pt-2 dark:border-neutral-800">
      <p className="font-medium text-neutral-700 dark:text-neutral-300">
        {en ? "Declared under construction (CNE)" : "Declarado en construcción (CNE)"}
      </p>
      <p>
        {en ? "Resolution" : "Resolución"}: {cneDeclaration.resolution ?? cneDeclaration.currentResolutionNumber}
        {" · "}
        {en ? "list in force" : "nómina vigente"} {fmt(cneDeclaration.currentResolutionDate)}
      </p>
      {cneDeclaration.originalInterconnectionDate && cneDeclaration.estimatedInterconnectionDate &&
        cneDeclaration.originalInterconnectionDate !== cneDeclaration.estimatedInterconnectionDate && (
          <p>
            {en ? "Interconnection moved from" : "Interconexión movida del"} {fmt(cneDeclaration.originalInterconnectionDate)}{" "}
            {en ? "to" : "al"} {fmt(cneDeclaration.estimatedInterconnectionDate)}
            <span className="text-neutral-400"> · {en ? "acknowledged by the CNE" : "reconocido por la CNE"}</span>
          </p>
        )}
      {cneDeclaration.matchedBy?.startsWith("auto_") && (
        <p className="text-neutral-400">
          {en ? "Link to this project made automatically; pending human review." : "Vínculo con este proyecto hecho automáticamente; pendiente de revisión humana."}
        </p>
      )}
    </div>
  );

  const constructionDetail = pgpProgress ? (
    <>
      {reportedMilestones.length > 0 && (
        <div className="mt-2 flex flex-col gap-0.5">
          <p className="font-medium text-neutral-700 dark:text-neutral-300">{en ? "Recorded in the filing" : "Registrado en el expediente"}</p>
          {reportedMilestones.map(([label, value]) => (
            <p key={label}>
              {label}: {value}
            </p>
          ))}
        </div>
      )}
      {(pgpProgress.serviceEstimateDate || pgpProgress.operativeEstimateDate) && (
        <div className="mt-2 flex flex-col gap-0.5">
          <p className="font-medium text-neutral-700 dark:text-neutral-300">{en ? "Estimated by the owner" : "Estimado por el titular"}</p>
          {pgpProgress.serviceEstimateDate && (
            <p>
              {en ? "Entry into Service (estimated)" : "Puesta en Servicio (estimada)"}:{" "}
              {new Date(pgpProgress.serviceEstimateDate).toLocaleDateString(en ? "en-GB" : "es-CL")}
            </p>
          )}
          {pgpProgress.operativeEstimateDate && (
            <p>
              {en ? "Commercial Operation (estimated)" : "Entrada en Operación (estimada)"}:{" "}
              {formatDateOnly(pgpProgress.operativeEstimateDate, en ? "en" : "es")}
            </p>
          )}
        </div>
      )}
      {constructionStartGap && (
        <p className="mt-2 font-medium text-amber-700 dark:text-amber-400">
          {en
            ? "Connection processing is complete, but PGP reports 0% physical progress."
            : "La tramitación de conexión está completa, pero PGP reporta 0% de avance físico."}
        </p>
      )}
      <p className="mt-2 text-neutral-400">
        {en ? "Official PGP reading observed on" : "Lectura oficial PGP observada el"} {new Date(pgpProgress.observedAt).toLocaleDateString(en ? "en-GB" : "es-CL")}.
      </p>
      <a href={pgpProgress.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block font-medium text-brand-deep underline">
        {en ? "View on PGP" : "Ver en PGP"} · NUP {pgpProgress.nup}
      </a>
      {cneBlock}
    </>
  ) : (
    <>
      <p>
        {en
          ? "This project does not yet have a registered entry in the Coordinator's Project Management Platform (PGP), so we cannot say whether works have started."
          : "Este proyecto aún no tiene registro en la Plataforma de Gestión de Proyectos (PGP) del Coordinador, así que no podemos decir si las obras empezaron."}
      </p>
      {cneBlock}
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <ExpandableProgressBar
        title={en ? "Connection status" : "Estado de conexión"}
        status={connectionStatus ?? (en ? "No connection status reported" : "Sin estado de conexión informado")}
        percentage={connectionMaturity?.order ?? null}
        badgeLabel={connectionTerminal ? (en ? "Process ended" : "Proceso terminado") : connectionMaturity ? `${connectionMaturity.order}%` : en ? "Progress unavailable" : "Sin avance calculable"}
        terminal={connectionTerminal}
        detail={connectionDetail}
        locale={locale}
      />
      {showSuctdSearch && <FindSuctdSiblingButton projectId={projectId} locale={locale} />}
      <ExpandableProgressBar
        title={secondBar.title}
        status={secondBar.status}
        percentage={secondBar.percentage}
        badgeLabel={secondBar.badgeLabel}
        terminal={secondBar.terminal}
        detail={secondBar.detail}
        locale={locale}
      />
      <ExpandableProgressBar
        title={en ? "Construction progress" : "Avance de Construcción"}
        status={pgpReading ? pgpReading.label : en ? "Not yet in the PGP construction program" : "Aún no está en el programa de seguimiento PGP"}
        percentage={pgpReading ? pgpReading.percent : null}
        badgeLabel={pgpReading ? `${pgpReading.percent}%` : en ? "No record" : "Sin registro"}
        noData={!pgpProgress}
        // El avance esperado y la desviación son un modelo nuestro, no un dato
        // del Coordinador — por eso van como marca de referencia sobre la barra
        // y rotulados "estimado", no como un segundo porcentaje oficial.
        expected={
          pgpProgress && pgpProgress.expectedProgressPercent !== null
            ? {
                percent: pgpProgress.expectedProgressPercent,
                label: `${en ? "Expected" : "Esperado"} ${Math.round(pgpProgress.expectedProgressPercent)}% ${
                  en ? "(estimated)" : "(estimado)"
                }${
                  pgpProgress.deviationPp !== null
                    ? ` · ${pgpProgress.deviationPp > 0 ? "+" : "−"}${Math.abs(Math.round(pgpProgress.deviationPp))} pp`
                    : ""
                }`,
              }
            : null
        }
        detail={constructionDetail}
        locale={locale}
      />
      <p className="text-[11px] leading-5 text-neutral-400 dark:text-neutral-500">
        {en
          ? "Percentages are an estimated maturity assessment based on each process's reported status; the construction bar reflects the physical-progress percentage officially reported in the PGP. None of these are official figures from the National Electricity Coordinator or SEA except where noted."
          : "Los porcentajes de conexión y ambiental son una lectura estimada de madurez según el estado informado en cada proceso; la barra de construcción refleja el porcentaje de avance físico reportado oficialmente en el PGP. Ninguno corresponde a un dato oficial del Coordinador Eléctrico Nacional o del SEA salvo donde se indica."}
      </p>
    </div>
  );
}
