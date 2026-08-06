import type { ConfirmedPertinencia } from "@/lib/data-access/pertinencias";
import { clasificarConclusionPertinencia } from "@/lib/data-access/pertinencias";
import type { AppLocale } from "@/lib/i18n";

export function PertinenciaStatusCard({ record, locale = "es" }: { record: ConfirmedPertinencia; locale?: AppLocale }) {
  const conclusion = clasificarConclusionPertinencia(record.estado, record.subEstado);
  const isIngreso = record.subEstado === "Resuelta - Ingreso al SEIA" || record.estado === "Derivada a SMA";
  const isNoIngreso = [
    "Resuelta - No ingreso al SEIA",
    "Resuelta - Desistida",
    "Resuelta - Abandono",
    "Resuelta - No admitida a tramitación",
  ].includes(record.subEstado ?? "");

  return (
    <div className="rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
          {locale === "en" ? "Pertinence consultation (SEA)" : "Consulta de pertinencia (SEA)"}
        </h3>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            isIngreso
              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
              : isNoIngreso
                ? "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                : "bg-brand-primary/15 text-brand-deep dark:text-brand-primary"
          }`}
        >
          {conclusion}
        </span>
      </div>
      <p className="mt-2 text-sm font-medium text-neutral-900 dark:text-neutral-50">{record.name}</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        {record.titularName && (
          <div>
            <dt className="text-xs text-neutral-500 dark:text-neutral-400">{locale === "en" ? "Holder" : "Titular"}</dt>
            <dd className="text-neutral-800 dark:text-neutral-200">{record.titularName}</dd>
          </div>
        )}
        {record.fechaPresentacion && (
          <div>
            <dt className="text-xs text-neutral-500 dark:text-neutral-400">{locale === "en" ? "Submission date" : "Fecha de presentación"}</dt>
            <dd className="text-neutral-800 dark:text-neutral-200">{new Date(record.fechaPresentacion).toLocaleDateString(locale === "en" ? "en-GB" : "es-CL")}</dd>
          </div>
        )}
        {record.fechaRespuesta && (
          <div>
            <dt className="text-xs text-neutral-500 dark:text-neutral-400">{locale === "en" ? "Response date" : "Fecha de respuesta"}</dt>
            <dd className="text-neutral-800 dark:text-neutral-200">{new Date(record.fechaRespuesta).toLocaleDateString(locale === "en" ? "en-GB" : "es-CL")}</dd>
          </div>
        )}
      </dl>
      {record.documentos.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {record.documentos.map((d, i) => (
            <li key={i}>
              <a
                href={d.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              >
                {d.nombre} →
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
