"use client";

import { useState } from "react";

interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortKey?: (row: T) => string | number;
  className?: string;
}

export function DataTable<T>({
  data,
  columns,
  onExportCsv,
  exportLabel,
}: {
  data: T[];
  columns: Column<T>[];
  onExportCsv?: () => void;
  exportLabel?: string;
}) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = [...data];
  if (sortCol) {
    const col = columns.find((c) => c.key === sortCol);
    if (col?.sortKey) {
      sorted.sort((a, b) => {
        const va = col.sortKey!(a);
        const vb = col.sortKey!(b);
        if (va < vb) return sortAsc ? -1 : 1;
        if (va > vb) return sortAsc ? 1 : -1;
        return 0;
      });
    }
  }

  function handleSort(key: string) {
    if (sortCol === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(key);
      setSortAsc(true);
    }
  }

  return (
    <div>
      {onExportCsv && (
        <div className="mb-2 flex justify-end">
          <button
            onClick={onExportCsv}
            className="rounded border border-pool-border px-3 py-1 text-xs font-medium text-muted hover:bg-surface-alt dark:border-pool-border dark:text-pool-light dark:hover:bg-surface-alt"
          >
            {exportLabel || "Export CSV"}
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-pool-border dark:border-pool-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-pool-border bg-pool-surface dark:border-pool-border dark:bg-surface-alt">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2.5 text-left font-semibold text-pool-deep dark:text-pool-light ${
                    col.sortKey ? "cursor-pointer select-none hover:text-pool-mid dark:hover:text-white" : ""
                  } ${col.className || ""}`}
                  onClick={() => col.sortKey && handleSort(col.key)}
                >
                  {col.header}
                  {sortCol === col.key && (
                    <span className="ml-1">{sortAsc ? "↑" : "↓"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-muted dark:text-pool-light/50"
                >
                  No data
                </td>
              </tr>
            ) : (
              sorted.map((row, i) => (
                <tr
                  key={i}
                  className={`water-row border-b border-pool-border/50 dark:border-pool-border/50 ${
                    i % 2 === 1 ? "bg-pool-surface/50 dark:bg-surface-alt/30" : ""
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3 py-2 text-foreground ${col.className || ""}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
