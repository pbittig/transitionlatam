"use client";

import { useState, useTransition } from "react";
import { toggleAppSetting } from "../watchlistActions";

export function AppSettingToggle({ settingKey, initiallyOn, label }: { settingKey: string; initiallyOn: boolean; label: string }) {
  const [on, setOn] = useState(initiallyOn);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    const next = !on;
    startTransition(async () => {
      const result = await toggleAppSetting(settingKey, next);
      if (result.success) setOn(next);
    });
  }

  return (
    <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
      <input type="checkbox" checked={on} disabled={pending} onChange={handleToggle} className="h-4 w-4" />
      {label}
    </label>
  );
}
