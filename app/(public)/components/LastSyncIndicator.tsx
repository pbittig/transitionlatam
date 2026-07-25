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
export function LastSyncIndicator({ isoTimestamp }: { isoTimestamp: string | null }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!isoTimestamp) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span>Datos actualizados {now ? relativeTime(isoTimestamp, now) : "…"}</span>
    </div>
  );
}
