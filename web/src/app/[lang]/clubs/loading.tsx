export default function Loading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-9 w-32 rounded bg-pool-border/50 dark:bg-pool-border/30" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 18 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-pool-border bg-surface px-4 py-3 dark:border-pool-border dark:bg-surface"
          >
            <div className="h-7 w-12 shrink-0 rounded bg-pool-border/50 dark:bg-pool-border/30" />
            <div className="h-4 w-32 flex-1 rounded bg-pool-border/50 dark:bg-pool-border/30" />
            <div className="h-4 w-6 shrink-0 rounded bg-pool-border/50 dark:bg-pool-border/30" />
          </div>
        ))}
      </div>
    </div>
  );
}
