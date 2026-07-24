"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MONTHS_HORIZON, monthLabel } from "@/lib/shared/connectionDateRange";

export function ConnectionDateRangeFilter({ basePath }: { basePath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parsedFrom = Number(searchParams.get("mesDesde") ?? "0");
  const parsedTo = Number(searchParams.get("mesHasta") ?? String(MONTHS_HORIZON));
  const [from, setFrom] = useState(Number.isFinite(parsedFrom) ? Math.min(Math.max(parsedFrom, 0), MONTHS_HORIZON) : 0);
  const [to, setTo] = useState(Number.isFinite(parsedTo) ? Math.min(Math.max(parsedTo, 0), MONTHS_HORIZON) : MONTHS_HORIZON);

  function commit(nextFrom: number, nextTo: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextFrom > 0) params.set("mesDesde", String(nextFrom));
    else params.delete("mesDesde");
    if (nextTo < MONTHS_HORIZON) params.set("mesHasta", String(nextTo));
    else params.delete("mesHasta");
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${basePath}?${query}` : basePath);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400">
        <span>Fecha de conexión:</span>
        <span className="font-medium text-neutral-900 dark:text-neutral-50">
          {from === 0 && to === MONTHS_HORIZON ? "Todo el horizonte (24 meses)" : `${monthLabel(from)} – ${monthLabel(to)}`}
        </span>
      </div>
      <div className="relative h-6 px-2">
        <div className="absolute top-1/2 right-2 left-2 h-1 -translate-y-1/2 rounded-full bg-neutral-200 dark:bg-neutral-800" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-neutral-900 dark:bg-neutral-50"
          style={{ left: `${8 + (from / MONTHS_HORIZON) * 100}%`, right: `${8 + (100 - (to / MONTHS_HORIZON) * 100)}%` }}
        />
        <input
          type="range"
          min={0}
          max={MONTHS_HORIZON}
          value={from}
          aria-label="Desde"
          onChange={(e) => {
            const v = Math.min(Number(e.target.value), to);
            setFrom(v);
            commit(v, to);
          }}
          className="range-thumb pointer-events-none absolute inset-x-0 top-0 h-6 w-full bg-transparent"
        />
        <input
          type="range"
          min={0}
          max={MONTHS_HORIZON}
          value={to}
          aria-label="Hasta"
          onChange={(e) => {
            const v = Math.max(Number(e.target.value), from);
            setTo(v);
            commit(from, v);
          }}
          className="range-thumb pointer-events-none absolute inset-x-0 top-0 h-6 w-full bg-transparent"
        />
      </div>
    </div>
  );
}
