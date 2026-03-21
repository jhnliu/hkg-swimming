export default function Loading() {
  return (
    <div className="flex flex-col gap-8 animate-pulse">
      <div>
        <div className="h-9 w-48 rounded bg-pool-border/50 dark:bg-pool-border/30" />
        <div className="mt-2 h-4 w-72 max-w-full rounded bg-pool-border/50 dark:bg-pool-border/30" />
      </div>

      {/* Swimmer pickers */}
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2].map((n) => (
          <div
            key={n}
            className="rounded-lg border border-pool-border bg-surface p-4 dark:border-pool-border dark:bg-surface"
          >
            <div className="h-4 w-20 rounded bg-pool-border/50 dark:bg-pool-border/30" />
            <div className="mt-3 h-10 w-full rounded-lg bg-pool-border/50 dark:bg-pool-border/30" />
          </div>
        ))}
      </div>

      {/* Results table */}
      <div className="overflow-hidden rounded-lg border border-pool-border dark:border-pool-border">
        <div className="h-10 bg-pool-surface dark:bg-surface-alt" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`flex items-center gap-4 border-t border-pool-border/50 px-3 py-2.5 ${
              i % 2 === 1 ? "bg-pool-surface/50 dark:bg-surface-alt/30" : ""
            }`}
          >
            <div className="h-4 w-24 rounded bg-pool-border/50 dark:bg-pool-border/30" />
            <div className="h-4 w-16 rounded bg-pool-border/50 dark:bg-pool-border/30" />
            <div className="ml-auto h-4 w-16 rounded bg-pool-border/50 dark:bg-pool-border/30" />
          </div>
        ))}
      </div>
    </div>
  );
}
