export function Panel({ children, className = "", ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      className={`rounded-lg border border-neutral-100 bg-white p-6 dark:border-neutral-900 dark:bg-neutral-950 ${className}`}
    >
      {children}
    </div>
  );
}
