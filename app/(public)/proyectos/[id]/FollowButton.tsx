"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toggleFollow } from "../../watchlistActions";
import type { AppLocale } from "@/lib/i18n";

export function FollowButton({
  projectId,
  initiallyFollowed,
  locked = false,
  locale = "es",
}: {
  projectId: string;
  initiallyFollowed: boolean;
  locked?: boolean;
  locale?: AppLocale;
}) {
  const [followed, setFollowed] = useState(initiallyFollowed);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    if (locked) return;
    const next = !followed;
    setError(null);
    startTransition(async () => {
      const result = await toggleFollow(projectId, next);
      if (result.success) setFollowed(next);
      else setError(result.error ?? (locale === "en" ? "Could not update tracking." : "No se pudo actualizar el seguimiento."));
    });
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={pending || locked}
      title={error ?? (locked ? (locale === "en" ? "Available on Prime" : "Disponible en plan Prime") : followed ? (locale === "en" ? "Following — click to unfollow" : "Siguiendo — clic para dejar de seguir") : (locale === "en" ? "Follow this project" : "Seguir este proyecto"))}
      aria-label={followed ? (locale === "en" ? "Unfollow" : "Dejar de seguir") : (locale === "en" ? "Follow" : "Seguir")}
      className={`print:hidden flex h-9 w-9 items-center justify-center rounded-lg border disabled:opacity-50 ${
        locked
          ? "cursor-not-allowed border-neutral-300 text-neutral-400 dark:border-neutral-700 dark:text-neutral-600"
          : followed
            ? "border-brand-deep bg-brand-primary text-[#173c38] shadow-sm ring-1 ring-brand-deep/20"
            : "border-brand-primary bg-brand-surface text-brand-deep shadow-sm hover:bg-brand-primary/25 dark:bg-brand-primary/15 dark:text-brand-primary"
      }`}
    >
      {followed ? <Eye size={16} strokeWidth={2} /> : <EyeOff size={16} strokeWidth={2} />}
    </button>
  );
}
