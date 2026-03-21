export default function Loading() {
  return (
    <div className="flex flex-col gap-8 animate-pulse">
      {/* Breadcrumb + title */}
      <div className="flex flex-col gap-2">
        <div className="h-4 w-40 rounded bg-pool-border/50 dark:bg-pool-border/30" />
        <div className="flex items-center gap-2">
          <div className="h-8 w-16 rounded bg-pool-border/50 dark:bg-pool-border/30" />
          <div className="h-6 w-40 rounded bg-pool-border/50 dark:bg-pool-border/30" />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-pool-border bg-surface p-4 dark:border-pool-border dark:bg-surface"
          >
            <div className="h-7 w-16 rounded bg-pool-border/50 dark:bg-pool-border/30" />
            <div className="mt-2 h-3 w-20 rounded bg-pool-border/50 dark:bg-pool-border/30" />
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2].map((n) => (
          <div key={n}>
            <div className="mb-3 h-6 w-36 rounded bg-pool-border/50 dark:bg-pool-border/30" />
            <div className="h-56 rounded-lg border border-pool-border bg-surface dark:border-pool-border dark:bg-surface" />
          </div>
        ))}
      </div>

      {/* Gender + Stroke row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2].map((n) => (
          <div key={n}>
            <div className="mb-3 h-6 w-28 rounded bg-pool-border/50 dark:bg-pool-border/30" />
            <div className="h-48 rounded-lg border border-pool-border bg-surface dark:border-pool-border dark:bg-surface" />
          </div>
        ))}
      </div>

      {/* Roster */}
      <div>
        <div className="mb-3 h-7 w-32 rounded bg-pool-border/50 dark:bg-pool-border/30" />
        <div className="overflow-hidden rounded-lg border border-pool-border dark:border-pool-border">
          <div className="h-10 bg-pool-surface dark:bg-surface-alt" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`flex items-center gap-4 border-t border-pool-border/50 px-3 py-2.5 ${
                i % 2 === 1 ? "bg-pool-surface/50 dark:bg-surface-alt/30" : ""
              }`}
            >
              <div className="h-4 w-32 rounded bg-pool-border/50 dark:bg-pool-border/30" />
              <div className="h-4 w-8 rounded bg-pool-border/50 dark:bg-pool-border/30" />
              <div className="ml-auto hidden h-4 w-24 rounded bg-pool-border/50 dark:bg-pool-border/30 sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
