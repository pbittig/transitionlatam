"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50"
      >
        <ChevronDown size={18} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
        {title}
      </button>
      {open && <div className="grid gap-4 sm:grid-cols-2">{children}</div>}
    </section>
  );
}
