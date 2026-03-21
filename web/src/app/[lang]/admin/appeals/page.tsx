import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { getAppeals } from "@/lib/db";
import type { AppealItem } from "@/lib/db";
import { reviewAppealAction } from "./actions";
import AdminLogin from "../AdminLogin";

export const metadata = { title: "Admin — Appeals", robots: "noindex" };

function AppealCard({
  item,
  lang,
  adminKey,
}: {
  item: AppealItem;
  lang: string;
  adminKey: string;
}) {
  const isPending = item.status === "pending";

  return (
    <div
      className={`rounded-lg border p-4 ${
        isPending
          ? "border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-900/20"
          : item.status === "approved"
            ? "border-emerald-300 bg-emerald-50/30 dark:border-emerald-700 dark:bg-emerald-900/10"
            : "border-red-300 bg-red-50/30 dark:border-red-700 dark:bg-red-900/10"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted dark:text-pool-light/50">
            #{item.id}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium ${
              item.status === "pending"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                : item.status === "approved"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                  : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
            }`}
          >
            {item.status}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium ${
              item.appeal_type === "missing_record"
                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300"
                : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
            }`}
          >
            {item.appeal_type === "missing_record"
              ? "Missing Record"
              : "Correction"}
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

      <div className="mt-3 grid gap-1 text-sm">
        <p>
          <span className="font-medium text-foreground">Swimmer:</span>{" "}
          <span className="text-muted dark:text-pool-light/60">
            {item.swimmer_name}
            {item.swimmer_id && ` (${item.swimmer_id})`}
          </span>
        </p>
        {item.competition_name && (
          <p>
            <span className="font-medium text-foreground">Competition:</span>{" "}
            <span className="text-muted dark:text-pool-light/60">
              {item.competition_name}
            </span>
          </p>
        )}
        {item.event_description && (
          <p>
            <span className="font-medium text-foreground">Event:</span>{" "}
            <span className="text-muted dark:text-pool-light/60">
              {item.event_description}
            </span>
          </p>
        )}
        {item.recorded_time && (
          <p>
            <span className="font-medium text-foreground">Recorded Time:</span>{" "}
            <span className="font-mono text-muted dark:text-pool-light/60">
              {item.recorded_time}
            </span>
          </p>
        )}
        <p className="mt-1">
          <span className="font-medium text-foreground">Reason:</span>{" "}
          <span className="text-muted dark:text-pool-light/60 whitespace-pre-wrap">
            {item.reason}
          </span>
        </p>
        <p>
          <span className="font-medium text-foreground">
            Requested Change:
          </span>{" "}
          <span className="text-muted dark:text-pool-light/60 whitespace-pre-wrap">
            {item.requested_change}
          </span>
        </p>
        <p className="text-xs text-muted/60 dark:text-pool-light/40">
          Submitted by: {item.submitter_name}
          {item.submitter_email && ` (${item.submitter_email})`}
        </p>
      </div>

      {item.admin_note && (
        <div className="mt-3 rounded border border-pool-border bg-pool-surface/30 px-3 py-2 text-sm dark:bg-surface-alt/30">
          <span className="font-medium text-foreground">Admin Note:</span>{" "}
          <span className="text-muted dark:text-pool-light/60">
            {item.admin_note}
          </span>
          {item.reviewed_at && (
            <span className="ml-2 text-xs text-muted/60 dark:text-pool-light/40">
              ({new Date(item.reviewed_at).toLocaleDateString()})
            </span>
          )}
        </div>
      )}

      {isPending && (
        <form action={reviewAppealAction} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="key" value={adminKey} />
          <input type="hidden" name="id" value={item.id} />

          <div className="flex flex-col gap-1">
            <label
              htmlFor={`note-${item.id}`}
              className="text-xs font-medium text-foreground"
            >
              Admin Note (optional)
            </label>
            <textarea
              id={`note-${item.id}`}
              name="admin_note"
              rows={2}
              maxLength={2000}
              placeholder="Add a note about your decision..."
              className="rounded-md border border-pool-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-pool-mid focus:outline-none focus:ring-1 focus:ring-pool-mid dark:border-pool-border dark:bg-pool-deep/50 dark:placeholder:text-pool-light/30"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              name="status"
              value="approved"
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              Approve
            </button>
            <button
              type="submit"
              name="status"
              value="rejected"
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Reject
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default async function AdminAppealsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{
    key?: string;
    reviewed?: string;
    error?: string;
  }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { key, reviewed, error } = await searchParams;

  if (!key || key !== process.env.ADMIN_KEY) {
    return <AdminLogin />;
  }

  const items = await getAppeals();
  const pending = items.filter((i) => i.status === "pending");
  const resolved = items.filter((i) => i.status !== "pending");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Admin — Result Appeals
        </h1>
        <p className="mt-1 text-sm text-muted dark:text-pool-light/60">
          Review and approve or reject result appeals.
        </p>
      </div>

      {reviewed && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          Appeal #{reviewed} has been reviewed.
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

      {/* Pending appeals */}
      <section>
        <h2 className="lane-line mb-4 text-xl font-semibold text-foreground">
          Pending Appeals ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-muted dark:text-pool-light/50">
            No pending appeals. All caught up!
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {pending.map((item) => (
              <AppealCard
                key={item.id}
                item={item}
                lang={lang}
                adminKey={key}
              />
            ))}
          </div>
        )}
      </section>

      {/* Resolved appeals */}
      {resolved.length > 0 && (
        <section>
          <h2 className="lane-line mb-4 text-xl font-semibold text-foreground">
            Resolved Appeals ({resolved.length})
          </h2>
          <div className="flex flex-col gap-4">
            {resolved.map((item) => (
              <AppealCard
                key={item.id}
                item={item}
                lang={lang}
                adminKey={key}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
