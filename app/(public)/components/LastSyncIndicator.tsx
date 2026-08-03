"use client";

import { useEffect, useState } from "react";

function relativeTime(iso: string, now: number): string {
  const diffMs = now - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "hace instantes";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `hace ${diffDays} d`;
}

// Marca de tiempo real (última sincronización guardada en la base de datos) —
// el ticker de "hace X" se recalcula solo, para que se sienta en vivo sin
// inventar un dato que no tenemos.
export function LastSyncIndicator({ isoTimestamp, label = "Datos actualizados" }: { isoTimestamp: string | null; label?: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const initialId = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearTimeout(initialId);
      clearInterval(id);
    };
  }, []);

  if (!isoTimestamp) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-primary opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-primary" />
      </span>
      <span>{label} {now ? relativeTime(isoTimestamp, now) : "…"}</span>
    </div>
  );
}
