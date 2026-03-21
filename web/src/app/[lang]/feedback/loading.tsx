export default function Loading() {
  return (
    <div className="flex flex-col gap-8 animate-pulse">
      <div className="h-9 w-36 rounded bg-pool-border/50 dark:bg-pool-border/30" />

      {/* Form skeleton */}
      <div className="rounded-lg border border-pool-border bg-surface p-6 dark:border-pool-border dark:bg-surface">
        <div className="flex flex-col gap-4">
          <div className="h-10 w-full rounded-lg bg-pool-border/50 dark:bg-pool-border/30" />
          <div className="h-10 w-full rounded-lg bg-pool-border/50 dark:bg-pool-border/30" />
          <div className="h-24 w-full rounded-lg bg-pool-border/50 dark:bg-pool-border/30" />
          <div className="h-10 w-28 rounded-lg bg-pool-border/50 dark:bg-pool-border/30" />
        </div>
      </div>

      {/* Feedback list */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-pool-border bg-surface p-4 dark:border-pool-border dark:bg-surface"
        >
          <div className="flex items-center gap-2">
            <div className="h-5 w-16 rounded bg-pool-border/50 dark:bg-pool-border/30" />
            <div className="h-5 w-48 rounded bg-pool-border/50 dark:bg-pool-border/30" />
          </div>
          <div className="mt-2 h-4 w-3/4 rounded bg-pool-border/50 dark:bg-pool-border/30" />
        </div>
      ))}
    </div>
  );
}
