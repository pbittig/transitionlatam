export function EditorialKpi({ value, suffix, label }: { value: string; suffix?: string; label: string }) {
  return (
    <div>
      <div className="text-4xl font-semibold tracking-tight text-neutral-900 md:text-5xl dark:text-neutral-50">
        {value}
        {suffix ? <span className="ml-1.5 text-2xl text-neutral-400 md:text-3xl dark:text-neutral-500">{suffix}</span> : null}
      </div>
      <div className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{label}</div>
    </div>
  );
}
