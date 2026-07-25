import type { Metadata } from "next";
import Link from "next/link";
import { RegistroForm } from "./RegistroForm";

export const metadata: Metadata = { title: "Crear cuenta" };
export const dynamic = "force-dynamic";

export default function RegistroPage() {
  return (
    <div className="flex min-h-full items-center justify-center bg-white p-6 dark:bg-neutral-900">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 p-8 shadow-sm dark:border-neutral-800">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Transition LATAM
        </h1>
        <p className="mt-1 mb-6 text-sm text-neutral-500 dark:text-neutral-400">
          Crea tu cuenta gratis — 14 días de acceso, sin tarjeta.
        </p>
        <RegistroForm />
        <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
          ¿Ya tienes cuenta?{" "}
          <Link href="/ingresar" className="font-medium text-neutral-900 hover:underline dark:text-neutral-50">
            Ingresa aquí
          </Link>
        </p>
        <p className="mt-10 text-[11px] leading-relaxed text-neutral-400 dark:text-neutral-600">
          Transition LATAM es una marca de ONIX Consulting Group. La tecnología, el análisis y la información
          presentados son un desarrollo propio de la compañía, construido a partir de fuentes de datos públicas.
        </p>
      </div>
    </div>
  );
}
