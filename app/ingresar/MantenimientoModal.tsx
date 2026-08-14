import { Wrench } from "lucide-react";

/**
 * Aviso de mantenimiento sobre la pantalla de ingreso.
 *
 * Va acá y no dentro de la app porque los administradores entran por
 * /admin/acceso, una ruta distinta: tapar el ingreso de clientes no les corta
 * el paso a ellos. Se puede seguir trabajando con la app en vivo.
 *
 * No es descartable a propósito — no lleva botón de cerrar ni cierra al hacer
 * clic en el fondo. Un aviso que se puede sacar de encima no deshabilita nada;
 * el formulario de abajo queda inerte y el server action rechaza igual, así que
 * cerrarlo solo daría una impresión falsa de que se puede entrar.
 */
export function MantenimientoModal({ locale }: { locale: "es" | "en" }) {
  const en = locale === "en";
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="mantenimiento-titulo"
      aria-describedby="mantenimiento-detalle"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-sm" aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-7 text-center shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-surface text-brand-deep dark:bg-neutral-800 dark:text-brand-primary">
          <Wrench size={22} strokeWidth={1.9} />
        </span>
        <h2
          id="mantenimiento-titulo"
          className="mt-4 text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50"
        >
          {en ? "System under maintenance" : "Sistema en mantenimiento"}
        </h2>
        <p id="mantenimiento-detalle" className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          {en
            ? "Access is temporarily disabled while we update the platform's data. It will be back shortly — thank you for your patience."
            : "El acceso está temporalmente deshabilitado mientras actualizamos los datos de la plataforma. Volveremos en breve — gracias por la paciencia."}
        </p>
      </div>
    </div>
  );
}
