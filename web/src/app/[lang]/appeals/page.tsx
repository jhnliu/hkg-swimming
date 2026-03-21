import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getAppeals } from "@/lib/db";
import { submitAppealAction } from "./actions";
import { AppealForm } from "@/components/appeal-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang as Locale);
  return { title: dict.appeals.title };
}

const STATUS_STYLES: Record<string, string> = {
  pending:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  approved:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
};

export default async function AppealsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { submitted, error } = await searchParams;

  const dict = await getDictionary(lang as Locale);
  const items = await getAppeals();

  const pendingCount = items.filter((i) => i.status === "pending").length;
  const approvedCount = items.filter((i) => i.status === "approved").length;
  const rejectedCount = items.filter((i) => i.status === "rejected").length;

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {dict.appeals.title}
        </h1>
        <p className="mt-1 text-sm text-muted dark:text-pool-light/60">
          {dict.appeals.subtitle}
        </p>
      </div>

      {/* Success / error banners */}
      {submitted && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          {dict.appeals.thankYou}
        </div>
      )}
      {error === "missing" && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
          {dict.appeals.errorMissing}
        </div>
      )}

      {/* Submit form */}
      <section>
        <h2 className="lane-line mb-4 text-xl font-semibold text-foreground">
          {dict.appeals.submitTitle}
        </h2>
        <AppealForm lang={lang} dict={dict} action={submitAppealAction} />
      </section>

      {/* Appeals list */}
      <section>
        <div className="mb-4 flex items-center gap-4">
          <h2 className="lane-line text-xl font-semibold text-foreground">
            {dict.appeals.listTitle}
          </h2>
          <div className="flex gap-2 text-xs">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              {pendingCount} {dict.appeals.pendingLabel}
            </span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
              {approvedCount} {dict.appeals.approvedLabel}
            </span>
            <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700 dark:bg-red-900/50 dark:text-red-300">
              {rejectedCount} {dict.appeals.rejectedLabel}
            </span>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="text-muted dark:text-pool-light/50">
            {dict.appeals.noItems}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-pool-border bg-white p-4 dark:border-pool-border dark:bg-surface-alt/50"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        STATUS_STYLES[item.status] || STATUS_STYLES.pending
                      }`}
                    >
                      {dict.appeals[
                        `${item.status}Label` as keyof typeof dict.appeals
                      ] || item.status}
                    </span>
                    <span className="rounded bg-pool-surface px-1.5 py-0.5 text-xs font-medium text-muted dark:bg-surface-alt dark:text-pool-light/60">
                      {dict.appeals[
                        `${item.appeal_type}Label` as keyof typeof dict.appeals
                      ] || item.appeal_type}
                    </span>
                  </div>
                  <span className="text-xs text-muted dark:text-pool-light/50">
                    {new Date(item.created_at).toLocaleDateString(
                      lang === "zh" ? "zh-HK" : "en-US",
                      { year: "numeric", month: "short", day: "numeric" }
                    )}
                  </span>
                </div>

                <h3 className="mt-2 font-medium text-foreground">
                  {item.swimmer_name}
                  {item.event_description && (
                    <span className="ml-2 text-sm font-normal text-muted dark:text-pool-light/60">
                      — {item.event_description}
                    </span>
                  )}
                </h3>

                {item.competition_name && (
                  <p className="mt-0.5 text-xs text-muted dark:text-pool-light/50">
                    {item.competition_name}
                    {item.recorded_time && ` · ${item.recorded_time}`}
                  </p>
                )}

                <p className="mt-2 text-sm text-muted dark:text-pool-light/60 whitespace-pre-wrap">
                  {item.reason}
                </p>
                <p className="mt-1 text-sm text-foreground">
                  <span className="font-medium">
                    {dict.appeals.requestedChangeLabel}:
                  </span>{" "}
                  {item.requested_change}
                </p>

                {item.admin_note && (
                  <div className="mt-3 rounded border border-pool-border bg-pool-surface/30 px-3 py-2 text-sm dark:bg-surface-alt/30">
                    <span className="font-medium text-foreground">
                      {dict.appeals.adminNote}:
                    </span>{" "}
                    <span className="text-muted dark:text-pool-light/60">
                      {item.admin_note}
                    </span>
                  </div>
                )}

                <p className="mt-2 text-xs text-muted/60 dark:text-pool-light/40">
                  {lang === "en" ? "By" : "提交者"}: {item.submitter_name}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
