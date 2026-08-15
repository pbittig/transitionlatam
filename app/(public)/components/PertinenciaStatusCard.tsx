import type { ConfirmedPertinencia } from "@/lib/data-access/pertinencias";
import { clasificarConclusionPertinencia } from "@/lib/data-access/pertinencias";
import type { AppLocale } from "@/lib/i18n";
import { formatDateOnly } from "@/lib/shared/formatDateOnly";

/**
 * Cuántos documentos se muestran antes de plegar el resto.
 *
 * El expediente trae 6 documentos en promedio y hasta 117, y la mayoría son
 * trámite: "Calendario proceso" solo aparece 5.455 veces en toda la tabla. Lo
 * que se necesita de un vistazo son la resolución que cierra el caso y la
 * consulta original; el resto es historial que casi nunca se abre.
 */
const DOCUMENTOS_VISIBLES = 3;

/**
 * Ordena por utilidad y quita repetidos.
 *
 * El origen repite nombres —1.677 fichas tienen al menos uno duplicado, casi
 * siempre "Calendario proceso" varias veces— y los lista en orden de trámite,
 * que deja la resolución final abajo del todo. Acá se invierte: primero lo que
 * resuelve, después la consulta que abrió el caso, y al final el procedimiento.
 */
function ordenarDocumentos(documentos: ConfirmedPertinencia["documentos"]) {
  const vistos = new Set<string>();
  const unicos = documentos.filter((d) => {
    const clave = d.nombre.trim().toLowerCase();
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });

  const prioridad = (nombre: string): number => {
    const n = nombre.toLowerCase();
    if (n.startsWith("resolución") || n.startsWith("resolucion")) return 0;
    if (n.includes("consulta de pertinencia")) return 1;
    if (n.includes("calendario")) return 3;
    return 2;
  };
  // Estable dentro de cada grupo: se conserva el orden del expediente, que es
  // cronológico, en vez de imponer uno alfabético que no significa nada.
  return unicos.map((d, i) => ({ d, i })).sort((a, b) => prioridad(a.d.nombre) - prioridad(b.d.nombre) || a.i - b.i).map((x) => x.d);
}

function DocumentoLink({ documento }: { documento: ConfirmedPertinencia["documentos"][number] }) {
  return (
    <a
      href={documento.url}
      target="_blank"
      rel="noreferrer"
      className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
    >
      {documento.nombre} →
    </a>
  );
}

export function PertinenciaStatusCard({ record, locale = "es" }: { record: ConfirmedPertinencia; locale?: AppLocale }) {
  const conclusion = clasificarConclusionPertinencia(record.estado, record.subEstado);
  const documentos = ordenarDocumentos(record.documentos);
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
            <dd className="text-neutral-800 dark:text-neutral-200">{formatDateOnly(record.fechaPresentacion, locale === "en" ? "en" : "es")}</dd>
          </div>
        )}
        {record.fechaRespuesta && (
          <div>
            <dt className="text-xs text-neutral-500 dark:text-neutral-400">{locale === "en" ? "Response date" : "Fecha de respuesta"}</dt>
            <dd className="text-neutral-800 dark:text-neutral-200">{formatDateOnly(record.fechaRespuesta, locale === "en" ? "en" : "es")}</dd>
          </div>
        )}
      </dl>
      {documentos.length > 0 && (
        <div className="mt-3">
          <ul className="flex flex-col gap-1">
            {documentos.slice(0, DOCUMENTOS_VISIBLES).map((d, i) => (
              <li key={i}>
                <DocumentoLink documento={d} />
              </li>
            ))}
          </ul>
          {documentos.length > DOCUMENTOS_VISIBLES && (
            // <details> nativo: no necesita JavaScript ni convertir la tarjeta
            // en componente cliente solo para plegar una lista.
            <details className="mt-1 group">
              <summary className="cursor-pointer list-none text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-600 dark:hover:text-neutral-300">
                {locale === "en"
                  ? `${documentos.length - DOCUMENTOS_VISIBLES} more documents`
                  : `${documentos.length - DOCUMENTOS_VISIBLES} documentos más`}
              </summary>
              <ul className="mt-1 flex flex-col gap-1">
                {documentos.slice(DOCUMENTOS_VISIBLES).map((d, i) => (
                  <li key={i}>
                    <DocumentoLink documento={d} />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
