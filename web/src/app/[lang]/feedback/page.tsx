import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getFeedback } from "@/lib/db";
import { submitFeedbackAction } from "./actions";
import { localizedMeta } from "@/lib/seo";
import FeedbackList from "./FeedbackList";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang as Locale);
  return localizedMeta({ lang: lang as Locale, dict, titleKey: dict.feedback.title, descriptionKey: "feedbackDescription", path: "/feedback" });
}

const CATEGORY_LABELS: Record<string, { en: string; zh: string }> = {
  bug: { en: "Bug Report", zh: "錯誤報告" },
  feature: { en: "Feature Request", zh: "功能請求" },
  data: { en: "Data Issue", zh: "數據問題" },
  feedback: { en: "General Feedback", zh: "一般意見" },
};

export default async function FeedbackPage({
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
  const items = await getFeedback();

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {dict.feedback.title}
        </h1>
        <p className="mt-1 text-sm text-muted dark:text-pool-light/60">
          {dict.feedback.subtitle}
        </p>
      </div>

      {/* Success / error banners */}
      {submitted && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          {dict.feedback.thankYou}
        </div>
      )}
      {error === "missing" && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
          {dict.feedback.errorMissing}
        </div>
      )}

      {/* Submit form */}
      <section>
        <h2 className="lane-line mb-4 text-xl font-semibold text-foreground">
          {dict.feedback.submitTitle}
        </h2>
        <form
          action={submitFeedbackAction}
          className="grid gap-4 rounded-lg border border-pool-border bg-pool-surface/50 p-5 dark:border-pool-border dark:bg-surface-alt/50 sm:grid-cols-2"
        >
          <input type="hidden" name="lang" value={lang} />

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="name"
              className="text-sm font-medium text-foreground"
            >
              {dict.feedback.nameLabel}
            </label>
            <input
              type="text"
              id="name"
              name="name"
              placeholder={dict.feedback.namePlaceholder}
              maxLength={100}
              className="rounded-md border border-pool-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-pool-mid focus:outline-none focus:ring-1 focus:ring-pool-mid dark:border-pool-border dark:bg-pool-deep/50 dark:placeholder:text-pool-light/30"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="category"
              className="text-sm font-medium text-foreground"
            >
              {dict.feedback.categoryLabel}
            </label>
            <select
              id="category"
              name="category"
              className="rounded-md border border-pool-border bg-white px-3 py-2 text-sm text-foreground focus:border-pool-mid focus:outline-none focus:ring-1 focus:ring-pool-mid dark:border-pool-border dark:bg-pool-deep/50"
            >
              {Object.entries(CATEGORY_LABELS).map(([key, labels]) => (
                <option key={key} value={key}>
                  {labels[lang as "en" | "zh"]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label
              htmlFor="title"
              className="text-sm font-medium text-foreground"
            >
              {dict.feedback.titleLabel}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              maxLength={200}
              placeholder={dict.feedback.titlePlaceholder}
              className="rounded-md border border-pool-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-pool-mid focus:outline-none focus:ring-1 focus:ring-pool-mid dark:border-pool-border dark:bg-pool-deep/50 dark:placeholder:text-pool-light/30"
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label
              htmlFor="description"
              className="text-sm font-medium text-foreground"
            >
              {dict.feedback.descriptionLabel}{" "}
              <span className="text-red-500">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              required
              rows={4}
              maxLength={2000}
              placeholder={dict.feedback.descriptionPlaceholder}
              className="rounded-md border border-pool-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-pool-mid focus:outline-none focus:ring-1 focus:ring-pool-mid dark:border-pool-border dark:bg-pool-deep/50 dark:placeholder:text-pool-light/30"
            />
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-pool-mid px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-pool-deep focus:outline-none focus:ring-2 focus:ring-pool-mid focus:ring-offset-2 dark:bg-pool-mid dark:hover:bg-pool-deep"
            >
              {dict.feedback.submitButton}
            </button>
          </div>
        </form>
      </section>

      <FeedbackList
        items={items}
        lang={lang}
        labels={{
          listTitle: dict.feedback.listTitle,
          openLabel: dict.feedback.openLabel,
          resolvedLabel: dict.feedback.resolvedLabel,
          noItems: dict.feedback.noItems,
        }}
      />
    </div>
  );
}
