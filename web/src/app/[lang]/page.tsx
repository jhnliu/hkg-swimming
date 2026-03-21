import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale, getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getCompetitions, getDbStats, tierLabel } from "@/lib/db";
import { HomeSearch } from "@/components/home-search";
import { alternatesForPath } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: alternatesForPath(""),
};

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const [dict, competitions, stats] = await Promise.all([
    getDictionary(lang as Locale),
    getCompetitions(),
    getDbStats(),
  ]);
  const recent = competitions.slice(0, 6);

  return (
    <div className="flex flex-col gap-10">
      {/* Hero */}
      <section className="relative flex flex-col items-center gap-3 overflow-x-clip rounded-2xl bg-gradient-to-br from-pool-deep via-pool-mid to-sky-400 px-4 pt-10 pb-8 text-center sm:gap-4 sm:px-6 sm:pt-14 sm:pb-10 dark:from-pool-deep dark:via-[#0f2440] dark:to-[#0c4a6e]">
        {/* Wave decoration */}
        <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 1440 60" preserveAspectRatio="none" style={{ height: "30px" }}>
          <path d="M0,30 C360,60 720,0 1080,30 C1260,45 1350,20 1440,30 L1440,60 L0,60 Z" fill="var(--background)" opacity="0.6" />
          <path d="M0,40 C360,60 720,15 1080,40 C1260,50 1350,30 1440,40 L1440,60 L0,60 Z" fill="var(--background)" />
        </svg>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">
          {dict.home.title}
        </h1>
        <p className="max-w-lg text-sm text-sky-100 sm:text-lg">
          {dict.home.subtitle}
        </p>
        <div className="mt-4 w-full max-w-xl">
          <HomeSearch lang={lang as Locale} placeholder={dict.home.searchPlaceholder} />
        </div>
      </section>

      {/* Database stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            value: stats.total_swimmers.toLocaleString(),
            label: lang === "en" ? "Swimmers" : "泳手",
            icon: (
              <svg className="h-5 w-5 text-pool-mid dark:text-pool-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            ),
          },
          {
            value: stats.total_results.toLocaleString(),
            label: lang === "en" ? "Race Results" : "比賽成績",
            icon: (
              <svg className="h-5 w-5 text-pool-mid dark:text-pool-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
          },
          {
            value: stats.total_competitions.toLocaleString(),
            label: lang === "en" ? "Competitions" : "比賽",
            icon: (
              <svg className="h-5 w-5 text-pool-mid dark:text-pool-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 15c2.483 0 4.345-3 6-3s3.517 3 6 3 4.345-3 6-3" />
              </svg>
            ),
          },
          {
            value: `${stats.date_from.slice(0, 4)}–${stats.date_to.slice(0, 4)}`,
            label: lang === "en" ? "Years of Data" : "數據年份",
            icon: (
              <svg className="h-5 w-5 text-pool-mid dark:text-pool-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            ),
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="depth-card rounded-lg border border-pool-border bg-surface p-4 dark:border-pool-border dark:bg-surface"
          >
            <div className="mb-2">{stat.icon}</div>
            <div className="text-lg font-bold text-foreground sm:text-2xl">
              {stat.value}
            </div>
            <div className="mt-1 text-xs text-muted dark:text-pool-light/60">
              {stat.label}
            </div>
          </div>
        ))}
      </section>

      {/* Recent competitions */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">
            {dict.home.recentCompetitions}
          </h2>
          <Link
            href={`/${lang}/competitions`}
            className="text-sm font-medium text-pool-mid hover:text-pool-deep dark:text-pool-light dark:hover:text-white"
          >
            {dict.home.viewAll} →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recent.map((comp) => (
            <Link
              key={comp.id}
              href={`/${lang}/competition/${comp.id}`}
              className="rounded-lg border border-pool-border bg-surface p-4 hover:border-pool-mid hover:shadow-md dark:border-pool-border dark:bg-surface dark:hover:border-pool-light"
            >
              <h3 className="font-medium text-foreground">
                {comp.name}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted dark:text-pool-light/60">
                <span>{comp.date}</span>
                <span>·</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                    comp.course === "LC"
                      ? "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300"
                      : "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300"
                  }`}
                >
                  {comp.course === "LC" ? dict.common.lc : dict.common.sc}
                </span>
                <span>·</span>
                <span>{tierLabel(comp.tier, lang as Locale)}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
