import type { SeiaRecordForProject } from "@/lib/data-access/seia";
import type { AppLocale } from "@/lib/i18n";

// Paleta de estado fija (nunca reutilizada para series categóricas) — ver
// references/palette.md de la skill de dataviz.
const STATUS_COLOR: Record<string, { light: string; dark: string; label: string }> = {
  aprobado: { light: "#0ca30c", dark: "#0ca30c", label: "Aprobado" },
  "en calificación": { light: "#fab219", dark: "#fab219", label: "En calificación" },
  "en calificacion": { light: "#fab219", dark: "#fab219", label: "En calificación" },
  rechazado: { light: "#d03b3b", dark: "#d03b3b", label: "Rechazado" },
  desistido: { light: "#898781", dark: "#898781", label: "Desistido" },
  "no calificado": { light: "#898781", dark: "#898781", label: "No calificado" },
};

export function SeiaStatusCard({
  record,
  confirmed = true,
  locale = "es",
}: {
  record: SeiaRecordForProject;
  /** false = el vínculo proyecto↔expediente lo propuso el matcher automático con confianza baja (ver lib/shared/seiaMatchTrust.ts). */
  confirmed?: boolean;
  locale?: AppLocale;
}) {
  const key = record.status?.toLowerCase().trim() ?? "";
  const color = STATUS_COLOR[key] ?? { light: "#898781", dark: "#898781", label: record.status ?? "Sin estado" };

  return (
    <div className="rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{locale === "en" ? "Environmental assessment (SEIA)" : "Evaluación ambiental (SEIA)"}</h3>
        <span
          className="rounded-full px-2.5 py-1 text-xs font-medium"
          style={
            confirmed
              ? {
                  color: `light-dark(${color.light}, ${color.dark})`,
                  backgroundColor: `light-dark(color-mix(in srgb, ${color.light} 15%, white), color-mix(in srgb, ${color.dark} 25%, black))`,
                }
              : // Sin color de estado: el estado del expediente no dice nada del
                // proyecto mientras el vínculo no esté confirmado.
                { color: "light-dark(#6B7280, #9CA3AF)", backgroundColor: "light-dark(#F3F4F6, #27272a)" }
          }
        >
          {confirmed ? color.label : locale === "en" ? "Unconfirmed link" : "Vínculo sin confirmar"}
        </span>
      </div>
      {!confirmed && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          {locale === "en"
            ? "Candidate found by automatic name matching with low confidence. It is not used as this project's environmental record until someone confirms it — check the filing before relying on it."
            : "Candidato encontrado por cruce automático de nombre con confianza baja. No se usa como antecedente ambiental del proyecto hasta que alguien lo confirme — revisá el expediente antes de darlo por válido."}
        </p>
      )}
      <p className="mt-2 text-sm font-medium text-neutral-900 dark:text-neutral-50">{record.nombre}</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        {record.titular && (
          <div>
            <dt className="text-xs text-neutral-500 dark:text-neutral-400">{locale === "en" ? "Holder" : "Titular"}</dt>
            <dd className="text-neutral-800 dark:text-neutral-200">{record.titular}</dd>
          </div>
        )}
        {record.submissionType && (
          <div>
            <dt className="text-xs text-neutral-500 dark:text-neutral-400">{locale === "en" ? "Submission type" : "Tipo de presentación"}</dt>
            <dd className="text-neutral-800 dark:text-neutral-200">{record.submissionType}</dd>
          </div>
        )}
        {record.filedAt && (
          <div>
            <dt className="text-xs text-neutral-500 dark:text-neutral-400">{locale === "en" ? "Submission date" : "Fecha de presentación"}</dt>
            <dd className="text-neutral-800 dark:text-neutral-200">{new Date(record.filedAt).toLocaleDateString(locale === "en" ? "en-GB" : "es-CL")}</dd>
          </div>
        )}
      </dl>
      {record.urlFicha && (
        <a
          href={record.urlFicha}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          {locale === "en" ? "View SEIA record" : "Ver ficha en SEIA"} →
        </a>
      )}
    </div>
  );
}
