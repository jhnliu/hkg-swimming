export default function Loading() {
  return (
    <div className="flex flex-col gap-10 animate-pulse">
      {/* Hero skeleton */}
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-pool-surface px-4 pt-10 pb-8 dark:bg-surface-alt sm:pt-14 sm:pb-10">
        <div className="h-9 w-72 rounded bg-pool-border/50 dark:bg-pool-border/30" />
        <div className="h-5 w-96 max-w-full rounded bg-pool-border/50 dark:bg-pool-border/30" />
        <div className="mt-4 h-12 w-full max-w-xl rounded-lg bg-pool-border/50 dark:bg-pool-border/30" />
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-pool-border bg-surface p-4 dark:border-pool-border dark:bg-surface"
          >
            <div className="mb-2 h-5 w-5 rounded bg-pool-border/50 dark:bg-pool-border/30" />
            <div className="h-7 w-20 rounded bg-pool-border/50 dark:bg-pool-border/30" />
            <div className="mt-2 h-3 w-16 rounded bg-pool-border/50 dark:bg-pool-border/30" />
          </div>
        ))}
      </div>

      {/* Recent competitions skeleton */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="h-7 w-48 rounded bg-pool-border/50 dark:bg-pool-border/30" />
          <div className="h-4 w-20 rounded bg-pool-border/50 dark:bg-pool-border/30" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-pool-border bg-surface p-4 dark:border-pool-border dark:bg-surface"
            >
              <div className="h-5 w-3/4 rounded bg-pool-border/50 dark:bg-pool-border/30" />
              <div className="mt-3 flex gap-2">
                <div className="h-4 w-20 rounded bg-pool-border/50 dark:bg-pool-border/30" />
                <div className="h-4 w-8 rounded bg-pool-border/50 dark:bg-pool-border/30" />
                <div className="h-4 w-16 rounded bg-pool-border/50 dark:bg-pool-border/30" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
