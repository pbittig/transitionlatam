import type { VerificationProgress } from "@/lib/data-access/projects";

/** Barra de progreso pública: cuántos proyectos del pipeline vigente ya pasaron por revisión manual — la tabla de abajo solo lista los verificados, el resto se sigue incorporando. */
export function VerificationProgressBar({ progress }: { progress: VerificationProgress }) {
  const pct = progress.total > 0 ? Math.round((progress.verified / progress.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-600 dark:text-neutral-400">
          <strong className="text-neutral-900 dark:text-neutral-50">{progress.verified.toLocaleString("es-CL")}</strong> de{" "}
          {progress.total.toLocaleString("es-CL")} proyectos verificados
        </span>
        <span className="text-brand-primary font-medium">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className="bg-brand-primary h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Solo mostramos proyectos ya revisados por nuestro equipo — seguimos incorporando el resto de la cartera.
      </p>
    </div>
  );
}
