import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale, getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import {
  getClubSwimmers,
  getClubAnalytics,
  getClubName,
} from "@/lib/db";
import { Breadcrumb } from "@/components/breadcrumb";
import {
  MemberChart,
  MedalChart,
  GenderPie,
  StrokeTable,
} from "@/components/club-charts";
import { alternatesForPath, ogMeta } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; code: string }>;
}): Promise<Metadata> {
  const { lang, code } = await params;
  const locale = (isLocale(lang) ? lang : "en") as Locale;
  const dict = await getDictionary(locale);
  const clubName = getClubName(code, locale);
  const displayName = clubName !== code ? `${clubName} (${code})` : code;
  const description = dict.seo.clubDescription.replace("{code}", displayName);
  const path = `/club/${code}`;
  return {
    title: displayName,
    description,
    alternates: alternatesForPath(path),
    openGraph: ogMeta({ title: displayName, description, path, lang: locale }),
  };
}

export default async function ClubPage({
  params,
}: {
  params: Promise<{ lang: string; code: string }>;
}) {
  const { lang, code } = await params;
  if (!isLocale(lang)) notFound();

  const [dict, swimmers, analytics] = await Promise.all([
    getDictionary(lang as Locale),
    getClubSwimmers(code),
    getClubAnalytics(code),
  ]);
  if (swimmers.length === 0) notFound();

  const { totals, seasonStats, strokeStrength } = analytics;

  const maleCount = swimmers.filter(
    (s) => s.gender === "Men" || s.gender === "Boys"
  ).length;
  const femaleCount = swimmers.length - maleCount;

  const en = lang === "en";
  const clubName = getClubName(code, en ? "en" : "zh");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Breadcrumb
          lang={lang as Locale}
          items={[
            { label: dict.nav.clubs, href: `/${lang}/clubs` },
            { label: clubName !== code ? clubName : code },
          ]}
        />
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-foreground sm:text-3xl">
          <span className="rounded bg-pool-surface px-2.5 py-0.5 font-mono text-xl dark:bg-surface-alt sm:text-2xl">
            {code}
          </span>
          {clubName !== code && (
            <span className="text-lg font-medium text-foreground/70 sm:text-xl">
              {clubName}
            </span>
          )}
        </h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="depth-card rounded-lg border border-pool-border bg-surface p-4 dark:border-pool-border dark:bg-surface">
          <div className="text-lg font-bold text-foreground sm:text-2xl">
            {totals.total_swimmers.toLocaleString()}
          </div>
          <div className="text-sm text-muted dark:text-pool-light/60">
            {en ? "Swimmers" : "泳手"}
          </div>
        </div>
        <div className="depth-card rounded-lg border border-pool-border bg-surface p-4 dark:border-pool-border dark:bg-surface">
          <div className="text-lg font-bold text-foreground sm:text-2xl">
            {totals.total_competitions.toLocaleString()}
          </div>
          <div className="text-sm text-muted dark:text-pool-light/60">
            {en ? "Competitions" : "比賽"}
          </div>
        </div>
        <div className="depth-card rounded-lg border border-pool-border bg-surface p-4 dark:border-pool-border dark:bg-surface">
          <div className="text-lg font-bold text-foreground sm:text-2xl">
            {totals.total_results.toLocaleString()}
          </div>
          <div className="text-sm text-muted dark:text-pool-light/60">
            {en ? "Results" : "成績"}
          </div>
        </div>
        <div className="depth-card rounded-lg border border-pool-border bg-surface p-4 dark:border-pool-border dark:bg-surface">
          <div className="flex items-center gap-1.5 text-lg font-bold sm:text-2xl">
            <span className="text-yellow-500">{totals.total_gold}</span>
            <span className="text-muted/40">/</span>
            <span className="text-muted/40">{totals.total_silver}</span>
            <span className="text-muted/40">/</span>
            <span className="text-amber-600">{totals.total_bronze}</span>
          </div>
          <div className="text-sm text-muted dark:text-pool-light/60">
            {en ? "G / S / B" : "金 / 銀 / 銅"}
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Member size over time */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            {en ? "Members by Season" : "每季泳手人數"}
          </h2>
          <div className="depth-card rounded-lg border border-pool-border bg-surface p-4 dark:border-pool-border dark:bg-surface">
            <MemberChart
              data={seasonStats}
              labels={{
                members: en ? "Members" : "泳手",
                male: dict.common.male,
                female: dict.common.female,
              }}
            />
          </div>
        </section>

        {/* Medals over time */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            {en ? "Medals by Season" : "每季獎牌"}
          </h2>
          <div className="depth-card rounded-lg border border-pool-border bg-surface p-4 dark:border-pool-border dark:bg-surface">
            <MedalChart
              data={seasonStats}
              labels={{
                gold: en ? "Gold" : "金牌",
                silver: en ? "Silver" : "銀牌",
                bronze: en ? "Bronze" : "銅牌",
              }}
            />
          </div>
        </section>
      </div>

      {/* Gender + Stroke row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Gender split */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            {en ? "Gender Split" : "性別比例"}
          </h2>
          <div className="depth-card rounded-lg border border-pool-border bg-surface p-4 dark:border-pool-border dark:bg-surface">
            <GenderPie
              male={maleCount}
              female={femaleCount}
              labels={{
                male: dict.common.male,
                female: dict.common.female,
              }}
            />
          </div>
        </section>

        {/* Stroke strength */}
        {strokeStrength.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              {en ? "Stroke Strength" : "泳式強項"}
            </h2>
            <StrokeTable
              data={strokeStrength}
              lang={lang}
            />
          </section>
        )}
      </div>

      {/* Roster */}
      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">
          {en ? "Roster" : "泳手名單"} ({swimmers.length})
        </h2>
        <div className="overflow-x-auto rounded-lg border border-pool-border dark:border-pool-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-pool-border bg-pool-surface dark:border-pool-border dark:bg-surface-alt">
                <th className="px-3 py-2 text-left font-semibold text-pool-deep dark:text-pool-light">
                  {dict.common.name}
                </th>
                <th className="px-3 py-2 text-center font-semibold text-pool-deep dark:text-pool-light">
                  {dict.leaderboard.gender}
                </th>
                <th className="hidden px-3 py-2 text-left font-semibold text-pool-deep dark:text-pool-light sm:table-cell">
                  ID
                </th>
              </tr>
            </thead>
            <tbody>
              {swimmers.map((s, i) => (
                <tr
                  key={s.id}
                  className={`water-row border-b border-pool-border/50 dark:border-pool-border/50 ${
                    i % 2 === 1 ? "bg-pool-surface/50 dark:bg-surface-alt/30" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/${lang}/swimmer/${encodeURIComponent(s.id)}`}
                      className="font-medium text-pool-mid hover:text-pool-deep dark:text-pool-light dark:hover:text-white"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-center text-muted dark:text-pool-light/60">
                    {s.gender === "Men" || s.gender === "Boys"
                      ? dict.common.male
                      : dict.common.female}
                  </td>
                  <td className="hidden px-3 py-2 font-mono text-xs text-muted/60 dark:text-pool-light/40 sm:table-cell">
                    {s.id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
