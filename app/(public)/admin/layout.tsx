import Link from "next/link";
import { isAdmin } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdmin();

  if (!admin) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Admin</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Esta sección es solo para administradores — inicia sesión para continuar.
        </p>
        <Link
          href="/login"
          className="w-fit rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-50 dark:text-neutral-900"
        >
          Ingresar
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
