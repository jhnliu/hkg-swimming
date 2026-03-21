export default function Loading() {
  return (
    <div className="flex flex-col gap-8 animate-pulse">
      {/* Breadcrumb */}
      <div className="flex flex-col gap-2">
        <div className="h-4 w-48 rounded bg-pool-border/50 dark:bg-pool-border/30" />
        {/* Swimmer card */}
        <div className="rounded-lg border border-pool-border bg-surface p-5 dark:border-pool-border dark:bg-surface">
          <div className="h-8 w-56 rounded bg-pool-border/50 dark:bg-pool-border/30" />
          <div className="mt-3 flex gap-3">
            <div className="h-6 w-14 rounded bg-pool-border/50 dark:bg-pool-border/30" />
            <div className="h-6 w-12 rounded bg-pool-border/50 dark:bg-pool-border/30" />
            <div className="h-6 w-28 rounded bg-pool-border/50 dark:bg-pool-border/30" />
            <div className="h-6 w-20 rounded bg-pool-border/50 dark:bg-pool-border/30" />
          </div>
          <div className="mt-2 flex gap-4">
            <div className="h-3 w-32 rounded bg-pool-border/50 dark:bg-pool-border/30" />
            <div className="h-3 w-32 rounded bg-pool-border/50 dark:bg-pool-border/30" />
          </div>
        </div>
      </div>

      {/* Personal Bests */}
      <div>
        <div className="h-7 w-36 rounded bg-pool-border/50 dark:bg-pool-border/30" />
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {[1, 2].map((col) => (
            <div key={col}>
              <div className="mb-2 h-4 w-24 rounded bg-pool-border/50 dark:bg-pool-border/30" />
              <div className="overflow-hidden rounded-lg border border-pool-border dark:border-pool-border">
                <div className="h-10 bg-pool-surface dark:bg-surface-alt" />
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-4 border-t border-pool-border/50 px-3 py-2.5 ${
                      i % 2 === 1
                        ? "bg-pool-surface/50 dark:bg-surface-alt/30"
                        : ""
                    }`}
                  >
                    <div className="h-4 w-28 rounded bg-pool-border/50 dark:bg-pool-border/30" />
                    <div className="ml-auto h-4 w-16 rounded bg-pool-border/50 dark:bg-pool-border/30" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Race History chart placeholder */}
      <div>
        <div className="h-7 w-32 rounded bg-pool-border/50 dark:bg-pool-border/30" />
        <div className="mt-4 h-64 rounded-lg border border-pool-border bg-surface dark:border-pool-border dark:bg-surface" />
      </div>
    </div>
  );
}
