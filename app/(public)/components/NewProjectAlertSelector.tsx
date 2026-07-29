"use client";

import { useState, useTransition } from "react";
import { BatteryCharging, Building2, Droplets, Leaf, Sun, Wind } from "lucide-react";
import type { NewProjectAlertCategory } from "@/lib/data-access/watchlist";
import { toggleAppSetting } from "../watchlistActions";

const OPTIONS: Array<{ key: NewProjectAlertCategory; label: string; icon: typeof Sun }> = [
  { key: "solar", label: "Solar", icon: Sun },
  { key: "wind", label: "Eólico", icon: Wind },
  { key: "hydro", label: "Hidroeléctrico", icon: Droplets },
  { key: "other_renewable", label: "Otras renovables", icon: Leaf },
  { key: "bess", label: "BESS", icon: BatteryCharging },
  { key: "data_center", label: "Data Centers", icon: Building2 },
];

export function NewProjectAlertSelector({ initialSelection }: { initialSelection: NewProjectAlertCategory[] }) {
  const [selected, setSelected] = useState(new Set(initialSelection));
  const [pending, startTransition] = useTransition();

  function toggle(key: NewProjectAlertCategory) {
    const nextOn = !selected.has(key);
    setSelected((current) => {
      const next = new Set(current);
      if (nextOn) next.add(key); else next.delete(key);
      return next;
    });
    startTransition(async () => {
      const result = await toggleAppSetting(`notify_new_${key}`, nextOn);
      if (!result.success) {
        setSelected((current) => {
          const rollback = new Set(current);
          if (nextOn) rollback.delete(key); else rollback.add(key);
          return rollback;
        });
      }
    });
  }

  return (
    <div>
      <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Avisarme de nuevos proyectos:</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {OPTIONS.map(({ key, label, icon: Icon }) => {
          const active = selected.has(key);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              disabled={pending}
              onClick={() => toggle(key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "border-brand-primary bg-brand-surface text-brand-deep dark:bg-brand-primary/10 dark:text-brand-primary"
                  : "border-neutral-200 bg-white text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-neutral-400">Puedes seleccionar una, varias o ninguna categoría.</p>
    </div>
  );
}
