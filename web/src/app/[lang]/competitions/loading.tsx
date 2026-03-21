export default function Loading() {
  return (
    <div className="flex flex-col gap-8 animate-pulse">
      <div className="h-9 w-48 rounded bg-pool-border/50 dark:bg-pool-border/30" />

      {[1, 2].map((section) => (
        <div key={section}>
          <div className="mb-3 h-6 w-28 rounded bg-pool-border/50 dark:bg-pool-border/30" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: section === 1 ? 6 : 4 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-lg border border-pool-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-pool-border dark:bg-surface"
              >
                <div className="h-5 w-64 max-w-full rounded bg-pool-border/50 dark:bg-pool-border/30" />
                <div className="flex gap-2">
                  <div className="h-4 w-20 rounded bg-pool-border/50 dark:bg-pool-border/30" />
                  <div className="h-4 w-8 rounded bg-pool-border/50 dark:bg-pool-border/30" />
                  <div className="h-4 w-16 rounded bg-pool-border/50 dark:bg-pool-border/30" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
