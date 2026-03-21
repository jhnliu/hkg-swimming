export default function Loading() {
  return (
    <div className="flex flex-col gap-8 animate-pulse">
      <div className="h-9 w-28 rounded bg-pool-border/50 dark:bg-pool-border/30" />
      <div className="h-12 w-full max-w-xl rounded-lg bg-pool-border/50 dark:bg-pool-border/30" />

      <div className="h-4 w-40 rounded bg-pool-border/50 dark:bg-pool-border/30" />

      {/* Results table skeleton */}
      <div>
        <div className="mb-3 h-6 w-24 rounded bg-pool-border/50 dark:bg-pool-border/30" />
        <div className="overflow-hidden rounded-lg border border-pool-border dark:border-pool-border">
          <div className="h-10 bg-pool-surface dark:bg-surface-alt" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`flex items-center gap-4 border-t border-pool-border/50 px-3 py-2.5 ${
                i % 2 === 1 ? "bg-pool-surface/50 dark:bg-surface-alt/30" : ""
              }`}
            >
              <div className="h-4 w-32 rounded bg-pool-border/50 dark:bg-pool-border/30" />
              <div className="h-4 w-24 rounded bg-pool-border/50 dark:bg-pool-border/30" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
