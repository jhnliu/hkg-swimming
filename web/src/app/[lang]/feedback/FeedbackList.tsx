"use client";

import { useState } from "react";
import type { FeedbackItem } from "@/lib/db";

const CATEGORY_LABELS: Record<string, { en: string; zh: string }> = {
  bug: { en: "Bug Report", zh: "錯誤報告" },
  feature: { en: "Feature Request", zh: "功能請求" },
  data: { en: "Data Issue", zh: "數據問題" },
  feedback: { en: "General Feedback", zh: "一般意見" },
};

const ALL_STATUSES = ["open", "in-progress", "resolved", "closed"] as const;

const STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  "in-progress":
    "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  resolved:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  closed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const STATUS_LABELS: Record<string, { en: string; zh: string }> = {
  open: { en: "open", zh: "待處理" },
  "in-progress": { en: "in-progress", zh: "處理中" },
  resolved: { en: "resolved", zh: "已解決" },
  closed: { en: "closed", zh: "已關閉" },
};

export default function FeedbackList({
  items,
  lang,
  labels,
}: {
  items: FeedbackItem[];
  lang: string;
  labels: { listTitle: string; openLabel: string; resolvedLabel: string; noItems: string };
}) {
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
    new Set(["open", "resolved"])
  );
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  const filtered = items.filter((item) => {
    if (selectedStatuses.size > 0 && !selectedStatuses.has(item.status)) return false;
    if (selectedUser && item.name !== selectedUser) return false;
    return true;
  });

  const uniqueNames = [...new Set(items.map((i) => i.name))].sort();

  const statusCounts = ALL_STATUSES.reduce(
    (acc, s) => {
      acc[s] = items.filter((i) => i.status === s).length;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <section>
      <div className="mb-4">
        <h2 className="lane-line text-xl font-semibold text-foreground">
          {labels.listTitle}
        </h2>
      </div>

      {/* Status filter */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          {lang === "en" ? "Status:" : "狀態:"}
        </span>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => toggleStatus(s)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              selectedStatuses.has(s)
                ? "bg-pool-mid text-white"
                : "bg-pool-surface text-muted hover:bg-pool-surface/80 dark:bg-surface-alt dark:text-pool-light/60"
            }`}
          >
            {STATUS_LABELS[s]?.[lang as "en" | "zh"] || s} ({statusCounts[s]})
          </button>
        ))}
      </div>

      {/* User filter */}
      {uniqueNames.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {lang === "en" ? "User:" : "用戶:"}
          </span>
          <button
            onClick={() => setSelectedUser(null)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              !selectedUser
                ? "bg-pool-mid text-white"
                : "bg-pool-surface text-muted hover:bg-pool-surface/80 dark:bg-surface-alt dark:text-pool-light/60"
            }`}
          >
            {lang === "en" ? "All" : "全部"}
          </button>
          {uniqueNames.map((name) => (
            <button
              key={name}
              onClick={() => setSelectedUser(name)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                selectedUser === name
                  ? "bg-pool-mid text-white"
                  : "bg-pool-surface text-muted hover:bg-pool-surface/80 dark:bg-surface-alt dark:text-pool-light/60"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Items */}
      {filtered.length === 0 ? (
        <p className="text-muted dark:text-pool-light/50">{labels.noItems}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-pool-border bg-white p-4 dark:border-pool-border dark:bg-surface-alt/50"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      STATUS_STYLES[item.status] || STATUS_STYLES.open
                    }`}
                  >
                    {STATUS_LABELS[item.status]?.[lang as "en" | "zh"] || item.status}
                  </span>
                  <span className="rounded bg-pool-surface px-1.5 py-0.5 text-xs font-medium text-muted dark:bg-surface-alt dark:text-pool-light/60">
                    {CATEGORY_LABELS[item.category]?.[lang as "en" | "zh"] ||
                      item.category}
                  </span>
                </div>
                <span className="text-xs text-muted dark:text-pool-light/50">
                  {new Date(item.created_at).toLocaleDateString(
                    lang === "zh" ? "zh-HK" : "en-US",
                    { year: "numeric", month: "short", day: "numeric" }
                  )}
                </span>
              </div>
              <h3 className="mt-2 font-medium text-foreground">{item.title}</h3>
              <p className="mt-1 text-sm text-muted dark:text-pool-light/60 whitespace-pre-wrap">
                {item.description}
              </p>
              <p className="mt-2 text-xs text-muted/60 dark:text-pool-light/40">
                {lang === "en" ? "By" : "提交者"}: {item.name}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
