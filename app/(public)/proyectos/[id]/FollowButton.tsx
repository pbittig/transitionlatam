"use client";

import { useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { toggleFollow } from "../../watchlistActions";

export function FollowButton({
  projectId,
  initiallyFollowed,
  locked = false,
}: {
  projectId: string;
  initiallyFollowed: boolean;
  locked?: boolean;
}) {
  const [followed, setFollowed] = useState(initiallyFollowed);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    if (locked) return;
    const next = !followed;
    startTransition(async () => {
      const result = await toggleFollow(projectId, next);
      if (result.success) setFollowed(next);
    });
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={pending || locked}
      title={locked ? "Disponible en plan Prime" : followed ? "Siguiendo — clic para dejar de seguir" : "Seguir este proyecto"}
      aria-label={followed ? "Dejar de seguir" : "Seguir"}
      className={`print:hidden flex h-9 w-9 items-center justify-center rounded-lg border disabled:opacity-50 ${
        locked
          ? "cursor-not-allowed border-neutral-300 text-neutral-400 dark:border-neutral-700 dark:text-neutral-600"
          : followed
            ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-900"
            : "border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      }`}
    >
      {followed ? <Bell size={16} strokeWidth={2} /> : <BellOff size={16} strokeWidth={2} />}
    </button>
  );
}
