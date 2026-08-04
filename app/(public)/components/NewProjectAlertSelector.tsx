"use client";

import { useState, useTransition } from "react";
import { BatteryCharging, Building2, Droplets, Leaf, Sun, Wind } from "lucide-react";
import type { NewProjectAlertCategory } from "@/lib/data-access/watchlist";
import { toggleAppSetting } from "../watchlistActions";
import type { AppLocale } from "@/lib/i18n";

const OPTIONS: Array<{ key: NewProjectAlertCategory; es: string; en: string; icon: typeof Sun }> = [
  { key: "solar", es: "Solar", en: "Solar", icon: Sun },
  { key: "wind", es: "Eólico", en: "Wind", icon: Wind },
  { key: "hydro", es: "Hidroeléctrico", en: "Hydro", icon: Droplets },
  { key: "other_renewable", es: "Otras renovables", en: "Other renewables", icon: Leaf },
  { key: "bess", es: "BESS", en: "BESS", icon: BatteryCharging },
  { key: "data_center", es: "Data Centers", en: "Data centers", icon: Building2 },
];

export function NewProjectAlertSelector({ initialSelection, locale = "es" }: { initialSelection: NewProjectAlertCategory[]; locale?: AppLocale }) {
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
      <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300">{locale === "en" ? "Notify me about new projects:" : "Avisarme de nuevos proyectos:"}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {OPTIONS.map(({ key, es, en, icon: Icon }) => {
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
              <Icon size={13} /> {locale === "en" ? en : es}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-neutral-400">{locale === "en" ? "Select one, several or no categories." : "Puedes seleccionar una, varias o ninguna categoría."}</p>
    </div>
  );
}
