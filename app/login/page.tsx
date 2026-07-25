import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Ingresar" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/");

  return (
    <div className="flex min-h-full items-center justify-center bg-white p-6 dark:bg-neutral-900">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 p-8 shadow-sm dark:border-neutral-800">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Transition LATAM
        </h1>
        <p className="mt-1 mb-6 text-sm text-neutral-500 dark:text-neutral-400">Acceso de administrador</p>
        <LoginForm />
      </div>
    </div>
  );
}
