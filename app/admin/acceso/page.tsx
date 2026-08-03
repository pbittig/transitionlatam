import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/session";
import { AdminAccessForm } from "./AdminAccessForm";

export const metadata: Metadata = {
  title: "Acceso administrativo",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminAccessPage() {
  if (await isAdmin()) redirect("/admin");

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-12">
      <div className="w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/tl-logo.png" alt="Transition LATAM" className="h-9 w-auto" />
        <div className="mt-10 border-t border-neutral-200 pt-8">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">Acceso administrativo</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            Gestión interna de proyectos, usuarios y requerimientos.
          </p>
          <AdminAccessForm />
        </div>
      </div>
    </main>
  );
}
