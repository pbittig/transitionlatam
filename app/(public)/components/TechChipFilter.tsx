import Link from "next/link";
import { TECH_CHIPS } from "./techChips";

function buildChipHref(basePath: string, otherParams: Record<string, string | undefined>, keys: string[]): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(otherParams)) {
    if (value) qs.set(key, value);
  }
  if (keys.length > 0) qs.set("tech", keys.join(","));
  const query = qs.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function TechChipFilter({
  basePath,
  selectedKeys,
  otherParams,
  excludeKeys,
}: {
  basePath: string;
  selectedKeys: string[];
  otherParams: Record<string, string | undefined>;
  excludeKeys?: string[];
}) {
  const pill = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-900"
        : "border-neutral-300 text-neutral-600 hover:border-neutral-400 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-500 dark:hover:text-neutral-50"
    }`;
  const chips = excludeKeys ? TECH_CHIPS.filter((chip) => !excludeKeys.includes(chip.key)) : TECH_CHIPS;

  return (
    <div className="flex flex-wrap gap-2">
      <Link href={buildChipHref(basePath, otherParams, [])} className={pill(selectedKeys.length === 0)}>
        Todas
      </Link>
      {chips.map((chip) => {
        const isSelected = selectedKeys.includes(chip.key);
        const nextKeys = isSelected ? selectedKeys.filter((k) => k !== chip.key) : [...selectedKeys, chip.key];
        return (
          <Link key={chip.key} href={buildChipHref(basePath, otherParams, nextKeys)} className={pill(isSelected)}>
            {chip.label}
          </Link>
        );
      })}
    </div>
  );
}
