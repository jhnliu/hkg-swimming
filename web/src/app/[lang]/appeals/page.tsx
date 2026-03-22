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

      {/* Status summary */}
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
    </div>
  );
}
