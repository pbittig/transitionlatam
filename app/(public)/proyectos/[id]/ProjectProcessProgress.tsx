import { getSeiaMaturity, isSeiaNegativeTerminal } from "@/lib/shared/seiaStatusMaturity";
import { getStatusMaturity, isRejectedStatus } from "@/lib/shared/projectStatusMaturity";
import { getPertinenciaMaturity, isPertinenciaNegativeTerminal } from "@/lib/shared/pertinenciaStatusMaturity";
import { clasificarConclusionPertinencia } from "@/lib/data-access/pertinencias";
import type { LatestPgpProgress } from "@/lib/data-access/pgpProgress";
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
  locale = "es",
}: {
  projectId: string;
  connectionStatus: string | null;
  externalReference?: string | null;
  environmentalStatus: string | null;
  seiaUrlFicha?: string | null;
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

  const connectionDetail = (
    <>
      <p>
        {en
          ? "Status reported in the Open Access connection-request portal of the National Electricity Coordinator."
          : "Estado informado en el portal de Acceso Abierto de solicitudes de conexión del Coordinador Eléctrico Nacional."}
      </p>
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
      status: en ? "No SEIA filing linked yet" : "Sin expediente SEIA asociado todavía",
      percentage: null,
      badgeLabel: en ? "No linked filing" : "Sin expediente asociado",
      terminal: false,
      detail: (
        <>
          <p>{en ? "No environmental filing has been linked to this project yet." : "Aún no se ha vinculado un expediente ambiental a este proyecto."}</p>
          {environmentalDetailExtra}
        </>
      ),
    };
  }

  const constructionDetail = pgpProgress ? (
    <>
      {(pgpProgress.serviceEstimateDate || pgpProgress.operativeEstimateDate) && (
        <div className="mt-2 flex flex-col gap-0.5">
          {pgpProgress.serviceEstimateDate && (
            <p>
              {en ? "Entry into Service (estimated)" : "Puesta en Servicio (estimada)"}:{" "}
              {new Date(pgpProgress.serviceEstimateDate).toLocaleDateString(en ? "en-GB" : "es-CL")}
            </p>
          )}
          {pgpProgress.operativeEstimateDate && (
            <p>
              {en ? "Commercial Operation (estimated)" : "Entrada en Operación (estimada)"}:{" "}
              {new Date(pgpProgress.operativeEstimateDate).toLocaleDateString(en ? "en-GB" : "es-CL")}
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
    </>
  ) : (
    <p>
      {en
        ? "This project does not yet have a registered entry in the Major Projects Program (PGP) construction tracking."
        : "Este proyecto aún no tiene registro en el seguimiento de construcción del Programa de Grandes Proyectos (PGP)."}
    </p>
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
