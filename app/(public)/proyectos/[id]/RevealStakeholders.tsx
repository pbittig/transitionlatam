"use client";

import { useEffect, useState, useTransition } from "react";
import { revealStakeholders } from "./seiaActions";
import type { ProjectStakeholder } from "@/lib/data-access/projects";

export function RevealStakeholders({
  projectId,
  developerCompanyId,
  isAdmin = false,
}: {
  projectId: string;
  developerCompanyId: string | null;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [adminSecret, setAdminSecret] = useState("");
  const [stakeholders, setStakeholders] = useState<ProjectStakeholder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleReveal(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await revealStakeholders(projectId, developerCompanyId, adminSecret);
      if (result.success) {
        setStakeholders(result.stakeholders ?? []);
      } else {
        setError(result.error ?? "No se pudo revelar.");
      }
    });
  }

  useEffect(() => {
    if (isAdmin) handleReveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (stakeholders !== null) {
    if (stakeholders.length === 0) {
      return <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin contactos registrados todavía.</p>;
    }
    return (
      <ul className="grid gap-3 sm:grid-cols-2">
        {stakeholders.map((s) => (
          <li key={s.personId} className="rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
            <div className="font-medium text-neutral-900 dark:text-neutral-50">{s.name}</div>
            <div className="text-neutral-500 dark:text-neutral-400">{s.role}</div>
            {s.email && <div className="mt-1 text-neutral-600 dark:text-neutral-400">{s.email}</div>}
            {s.phone && <div className="text-neutral-600 dark:text-neutral-400">{s.phone}</div>}
          </li>
        ))}
      </ul>
    );
  }

  if (isAdmin) {
    if (error) {
      return (
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => handleReveal()}
            disabled={pending}
            className="mt-2 text-xs font-medium text-neutral-500 underline underline-offset-2 hover:text-neutral-700 disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            Reintentar
          </button>
        </div>
      );
    }
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Cargando contactos...</p>;
  }

  return (
    <div className="print:hidden rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Los contactos son datos personales — solo visibles para administradores.
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 text-xs font-medium text-neutral-500 underline underline-offset-2 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          Revelar contactos
        </button>
      ) : (
        <form onSubmit={handleReveal} className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="password"
            autoFocus
            placeholder="Clave de administrador"
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            className="rounded-lg border border-neutral-300 bg-transparent px-3 py-1.5 text-sm dark:border-neutral-700"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {pending ? "Revelando..." : "Ver"}
          </button>
        </form>
      )}
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
