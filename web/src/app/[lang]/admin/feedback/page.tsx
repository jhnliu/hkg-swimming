import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { getFeedback } from "@/lib/db";
import type { FeedbackItem } from "@/lib/db";
import { updateFeedbackAction } from "./actions";
import AdminLogin from "../AdminLogin";

export const metadata = { title: "Admin — Feedback", robots: "noindex" };

const CATEGORY_LABELS: Record<string, string> = {
  bug: "Bug Report",
  feature: "Feature Request",
  data: "Data Issue",
  feedback: "General Feedback",
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  "in-progress":
    "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  resolved:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  closed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const ALL_STATUSES = ["open", "in-progress", "resolved", "closed"];

function FeedbackCard({
  item,
  lang,
  adminKey,
}: {
  item: FeedbackItem;
  lang: string;
  adminKey: string;
}) {
  return (
    <div className="rounded-lg border border-pool-border bg-white p-4 dark:border-pool-border dark:bg-surface-alt/50">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted dark:text-pool-light/50">
            #{item.id}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium ${
              STATUS_STYLES[item.status] || STATUS_STYLES.open
            }`}
          >
            {item.status}
          </span>
          <span className="rounded bg-pool-surface px-1.5 py-0.5 text-xs font-medium text-muted dark:bg-surface-alt dark:text-pool-light/60">
            {CATEGORY_LABELS[item.category] || item.category}
          </span>
        </div>
        <span className="text-xs text-muted dark:text-pool-light/50">
          {new Date(item.created_at).toLocaleString(
            lang === "zh" ? "zh-HK" : "en-US",
            {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }
          )}
        </span>
      </div>

      <h3 className="mt-2 font-medium text-foreground">{item.title}</h3>
      <p className="mt-1 text-sm text-muted dark:text-pool-light/60 whitespace-pre-wrap">
        {item.description}
      </p>
      <p className="mt-2 text-xs text-muted/60 dark:text-pool-light/40">
        Submitted by: {item.name}
      </p>

      {/* Status update form */}
      <form
        action={updateFeedbackAction}
        className="mt-4 flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="key" value={adminKey} />
        <input type="hidden" name="id" value={item.id} />

        <div className="flex flex-col gap-1">
          <label
            htmlFor={`status-${item.id}`}
            className="text-xs font-medium text-foreground"
          >
            Update Status
          </label>
          <select
            id={`status-${item.id}`}
            name="status"
            defaultValue={item.status}
            className="rounded-md border border-pool-border bg-white px-3 py-2 text-sm text-foreground focus:border-pool-mid focus:outline-none focus:ring-1 focus:ring-pool-mid dark:border-pool-border dark:bg-pool-deep/50"
          >
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="rounded-md bg-pool-mid px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pool-deep focus:outline-none focus:ring-2 focus:ring-pool-mid focus:ring-offset-2"
        >
          Save
        </button>
      </form>
    </div>
  );
}

export default async function AdminFeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{
    key?: string;
    updated?: string;
    error?: string;
    filter?: string;
    user?: string;
  }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { key, updated, error, filter, user } = await searchParams;

  if (!key || key !== process.env.ADMIN_KEY) {
    return <AdminLogin />;
  }

  const allItems = await getFeedback();

  const DEFAULT_STATUSES = ["open", "resolved"];
  const activeFilter = filter === "all"
    ? null
    : filter && ALL_STATUSES.includes(filter)
      ? filter
      : null;
  const isDefault = !filter;

  let items = isDefault
    ? allItems.filter((i) => DEFAULT_STATUSES.includes(i.status))
    : activeFilter
      ? allItems.filter((i) => i.status === activeFilter)
      : allItems;

  // Apply user filter
  const activeUser = user || null;
  if (activeUser) {
    items = items.filter((i) => i.name === activeUser);
  }

  const uniqueNames = [...new Set(allItems.map((i) => i.name))].sort();

  const counts = ALL_STATUSES.reduce(
    (acc, s) => {
      acc[s] = allItems.filter((i) => i.status === s).length;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Admin — Feedback
        </h1>
        <p className="mt-1 text-sm text-muted dark:text-pool-light/60">
          Manage feedback status. {allItems.length} total items.
        </p>
      </div>

      {updated && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          Feedback #{updated} has been updated.
        </div>
      )}
      {error === "unauthorized" && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
          Unauthorized. Invalid admin key.
        </div>
      )}
      {error === "invalid" && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
          Invalid request. Please try again.
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3">
        {/* Status tabs */}
        <div className="flex flex-wrap gap-2">
          <a
            href={`/${lang}/admin/feedback?key=${key}${activeUser ? `&user=${encodeURIComponent(activeUser)}` : ""}`}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              isDefault
                ? "bg-pool-mid text-white"
                : "bg-pool-surface text-muted hover:bg-pool-surface/80 dark:bg-surface-alt dark:text-pool-light/60"
            }`}
          >
            Open + Resolved ({allItems.filter((i) => DEFAULT_STATUSES.includes(i.status)).length})
          </a>
          <a
            href={`/${lang}/admin/feedback?key=${key}&filter=all${activeUser ? `&user=${encodeURIComponent(activeUser)}` : ""}`}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              filter === "all"
                ? "bg-pool-mid text-white"
                : "bg-pool-surface text-muted hover:bg-pool-surface/80 dark:bg-surface-alt dark:text-pool-light/60"
            }`}
          >
            All ({allItems.length})
          </a>
          {ALL_STATUSES.map((s) => (
            <a
              key={s}
              href={`/${lang}/admin/feedback?key=${key}&filter=${s}${activeUser ? `&user=${encodeURIComponent(activeUser)}` : ""}`}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                activeFilter === s
                  ? "bg-pool-mid text-white"
                  : "bg-pool-surface text-muted hover:bg-pool-surface/80 dark:bg-surface-alt dark:text-pool-light/60"
              }`}
            >
              {s} ({counts[s]})
            </a>
          ))}
        </div>

        {/* User filter */}
        {uniqueNames.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">User:</span>
            <a
              href={`/${lang}/admin/feedback?key=${key}${filter ? `&filter=${filter}` : ""}`}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                !activeUser
                  ? "bg-pool-mid text-white"
                  : "bg-pool-surface text-muted hover:bg-pool-surface/80 dark:bg-surface-alt dark:text-pool-light/60"
              }`}
            >
              All
            </a>
            {uniqueNames.map((name) => (
              <a
                key={name}
                href={`/${lang}/admin/feedback?key=${key}${filter ? `&filter=${filter}` : ""}&user=${encodeURIComponent(name)}`}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  activeUser === name
                    ? "bg-pool-mid text-white"
                    : "bg-pool-surface text-muted hover:bg-pool-surface/80 dark:bg-surface-alt dark:text-pool-light/60"
                }`}
              >
                {name}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Feedback items */}
      {items.length === 0 ? (
        <p className="text-muted dark:text-pool-light/50">
          No feedback items{activeFilter ? ` with status "${activeFilter}"` : ""}.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <FeedbackCard
              key={item.id}
              item={item}
              lang={lang}
              adminKey={key}
            />
          ))}
        </div>
      )}
    </div>
  );
}
