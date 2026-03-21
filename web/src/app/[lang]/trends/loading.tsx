export default function Loading() {
  return (
    <div className="flex flex-col gap-10 animate-pulse">
      {/* Title */}
      <div>
        <div className="h-9 w-32 rounded bg-pool-border/50 dark:bg-pool-border/30" />
        <div className="mt-2 h-4 w-64 rounded bg-pool-border/50 dark:bg-pool-border/30" />
      </div>

      {/* Biggest Improvers section */}
      <div>
        <div className="h-7 w-44 rounded bg-pool-border/50 dark:bg-pool-border/30" />
        <div className="mt-1 h-4 w-80 max-w-full rounded bg-pool-border/50 dark:bg-pool-border/30" />

        {/* Filters */}
        <div className="mt-4 mb-4 flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-7 w-14 rounded-md bg-pool-surface dark:bg-surface-alt"
            />
          ))}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-lg border border-pool-border dark:border-pool-border">
          <div className="h-10 bg-pool-surface dark:bg-surface-alt" />
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className={`flex items-center gap-4 border-t border-pool-border/50 px-3 py-2.5 ${
                i % 2 === 1 ? "bg-pool-surface/50 dark:bg-surface-alt/30" : ""
              }`}
            >
              <div className="h-4 w-6 rounded bg-pool-border/50 dark:bg-pool-border/30" />
              <div className="h-4 w-28 rounded bg-pool-border/50 dark:bg-pool-border/30" />
              <div className="hidden h-4 w-10 rounded bg-pool-border/50 dark:bg-pool-border/30 sm:block" />
              <div className="hidden h-4 w-24 rounded bg-pool-border/50 dark:bg-pool-border/30 sm:block" />
              <div className="ml-auto h-4 w-14 rounded bg-pool-border/50 dark:bg-pool-border/30" />
            </div>
          ))}
        </div>
      </div>

      {/* Breakthrough Swims section */}
      <div>
        <div className="h-7 w-44 rounded bg-pool-border/50 dark:bg-pool-border/30" />
        <div className="mt-1 h-4 w-72 max-w-full rounded bg-pool-border/50 dark:bg-pool-border/30" />
        <div className="mt-4 overflow-hidden rounded-lg border border-pool-border dark:border-pool-border">
          <div className="h-10 bg-pool-surface dark:bg-surface-alt" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`flex items-center gap-4 border-t border-pool-border/50 px-3 py-2.5 ${
                i % 2 === 1 ? "bg-pool-surface/50 dark:bg-surface-alt/30" : ""
              }`}
            >
              <div className="h-4 w-28 rounded bg-pool-border/50 dark:bg-pool-border/30" />
              <div className="hidden h-4 w-10 rounded bg-pool-border/50 dark:bg-pool-border/30 sm:block" />
              <div className="ml-auto h-4 w-16 rounded bg-pool-border/50 dark:bg-pool-border/30" />
              <div className="h-5 w-8 rounded bg-pool-border/50 dark:bg-pool-border/30" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
