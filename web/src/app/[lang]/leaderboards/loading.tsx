export default function Loading() {
  return (
    <div className="flex flex-col gap-8 animate-pulse">
      <div>
        <div className="h-9 w-48 rounded bg-pool-surface dark:bg-surface-alt" />
        <div className="mt-2 h-4 w-72 rounded bg-pool-surface dark:bg-surface-alt" />
      </div>

      {/* Event filter skeleton */}
      <div className="flex flex-col gap-2 rounded-lg border border-pool-border bg-surface p-3 dark:border-pool-border dark:bg-surface">
        {[1, 2, 3].map((row) => (
          <div key={row} className="flex items-center gap-1.5">
            <div className="h-4 w-16 rounded bg-pool-surface dark:bg-surface-alt" />
            {Array.from({ length: row === 3 ? 2 : 5 }).map((_, i) => (
              <div key={i} className="h-7 w-14 rounded-md bg-pool-surface dark:bg-surface-alt" />
            ))}
          </div>
        ))}
      </div>

      {/* Secondary filter skeleton */}
      <div className="flex items-center gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-7 w-16 rounded-md bg-pool-surface dark:bg-surface-alt" />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-lg border border-pool-border dark:border-pool-border">
        <div className="h-10 bg-pool-surface dark:bg-surface-alt" />
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className={`flex items-center gap-4 border-t border-pool-border/50 px-3 py-2.5 ${
              i % 2 === 1 ? "bg-pool-surface/50 dark:bg-surface-alt/30" : ""
            }`}
          >
            <div className="h-6 w-6 rounded-full bg-pool-surface dark:bg-surface-alt" />
            <div className="h-4 w-32 rounded bg-pool-surface dark:bg-surface-alt" />
            <div className="h-4 w-12 rounded bg-pool-surface dark:bg-surface-alt" />
            <div className="h-4 w-8 rounded bg-pool-surface dark:bg-surface-alt" />
            <div className="ml-auto h-4 w-16 rounded bg-pool-surface dark:bg-surface-alt" />
            <div className="h-4 w-20 rounded bg-pool-surface dark:bg-surface-alt" />
          </div>
        ))}
      </div>
    </div>
  );
}
