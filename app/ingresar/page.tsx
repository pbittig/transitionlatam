import type { Metadata } from "next";
import Link from "next/link";
import { IngresarForm } from "./IngresarForm";
import { EnergyVisual } from "./EnergyVisual";

export const metadata: Metadata = { title: "Ingresar" };
export const dynamic = "force-dynamic";

export default function IngresarPage() {
  return (
    <div className="grid min-h-full grid-cols-1 md:grid-cols-2">
      <div className="hidden md:block">
        <EnergyVisual />
      </div>

      <div className="flex items-center justify-center bg-white p-6 dark:bg-neutral-900">
        <div className="w-full max-w-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tl-logo.png" alt="Transition LATAM" className="h-9 w-auto" />
          <h1 className="mt-8 text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            Ingresa a tu cuenta
          </h1>
          <p className="mt-1 mb-6 text-sm text-neutral-500 dark:text-neutral-400">
            Accede con tu correo y clave.
          </p>
          <IngresarForm />
          <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
            ¿No tienes cuenta?{" "}
            <Link href="/registro" className="font-medium text-neutral-900 hover:underline dark:text-neutral-50">
              Crea una gratis
            </Link>
          </p>
          <p className="mt-10 text-[11px] leading-relaxed text-neutral-400 dark:text-neutral-600">
            Transition LATAM es una marca de ONIX Consulting Group. La tecnología, el análisis y la información
            presentados son un desarrollo propio de la compañía, construido a partir de fuentes de datos públicas.
          </p>
        </div>
      </div>
    </div>
  );
}
