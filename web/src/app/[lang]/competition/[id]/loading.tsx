export default function Loading() {
  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      {/* Header skeleton */}
      <div className="flex flex-col gap-3">
        <div className="h-4 w-48 rounded bg-pool-border/50 dark:bg-pool-border/30" />
        <div className="h-8 w-96 max-w-full rounded bg-pool-border/50 dark:bg-pool-border/30" />
        <div className="flex gap-3">
          <div className="h-5 w-24 rounded bg-pool-border/50 dark:bg-pool-border/30" />
          <div className="h-5 w-12 rounded bg-pool-border/50 dark:bg-pool-border/30" />
          <div className="h-5 w-20 rounded bg-pool-border/50 dark:bg-pool-border/30" />
        </div>
      </div>

      {/* Results skeleton */}
      <div className="flex flex-col gap-4">
        <div className="h-6 w-40 rounded bg-pool-border/50 dark:bg-pool-border/30" />
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-pool-mid/30 border-t-pool-mid dark:border-pool-light/30 dark:border-t-pool-light" />
        </div>
      </div>
    </div>
  );
}
