import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale, getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getHkssfSchoolRankings, getHkssfFilterOptions } from "@/lib/db";
import { NavSelect } from "@/components/nav-select";
import { Breadcrumb } from "@/components/breadcrumb";
import { localizedMeta } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang as Locale);
  return localizedMeta({
    lang: lang as Locale,
    dict,
    titleKey: dict.interSchool.rankings,
    descriptionKey: "interSchoolRankingsDescription",
    path: "/inter-school/rankings",
  });
}

function seasonDisplay(code: string): string {
  if (code.length !== 4) return code;
  const y1 = parseInt("20" + code.slice(0, 2));
  const y2 = parseInt("20" + code.slice(2, 4));
  return `${y1}-${y2}`;
}

function MedalRank({ rank }: { rank: number }) {
  if (rank === 1)
    return <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-yellow-100 text-xs font-bold text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300">1</span>;
  if (rank === 2)
    return <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500 dark:bg-gray-700/50 dark:text-gray-300">2</span>;
  if (rank === 3)
    return <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">3</span>;
  return <span className="text-muted dark:text-pool-light/50">{rank}</span>;
}

export default async function RankingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ season?: string; division?: string; gender?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const { season: seasonParam, division, gender: genderParam } = await searchParams;

  const filterOptions = await getHkssfFilterOptions();

  // Default to latest season and male
  const season = seasonParam || filterOptions.seasons[0];
  const gender = genderParam || "M";

  const [dict, rankings] = await Promise.all([
    getDictionary(lang as Locale),
    getHkssfSchoolRankings(season, division, gender),
  ]);

  const PILL = "rounded-md px-2 py-1 text-xs font-medium transition-colors";
  const PILL_ACTIVE = `${PILL} filter-active`;
  const PILL_INACTIVE = `${PILL} bg-pool-surface text-muted hover:bg-pool-border dark:bg-surface-alt dark:text-pool-light/70 dark:hover:bg-pool-border`;

  function filterUrl(key: string, value: string | undefined): string {
    const p = new URLSearchParams();
    const s = key === "season" ? value : season;
    const g = key === "gender" ? value : gender;
    const d = key === "division" ? value : division;
    if (s) p.set("season", s);
    if (d) p.set("division", d);
    if (g) p.set("gender", g);
    return `/${lang}/inter-school/rankings?${p.toString()}`;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Breadcrumb
          lang={lang as Locale}
          items={[
            { label: dict.interSchool.title, href: `/${lang}/inter-school` },
            { label: dict.interSchool.rankings },
          ]}
        />
        <h1 className="text-3xl font-bold text-foreground">
          {dict.interSchool.rankings}
        </h1>
        <p className="mt-1 text-sm text-muted dark:text-pool-light/60">
          {dict.interSchool.subtitle}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <NavSelect
          id="season"
          label={dict.interSchool.season}
          value={season}
          options={filterOptions.seasons.map((s) => ({ value: s, label: seasonDisplay(s) }))}
          urlMap={Object.fromEntries(filterOptions.seasons.map((s) => [s, filterUrl("season", s)]))}
        />

        <span className="text-pool-border dark:text-pool-border">|</span>

        <span className="text-xs font-medium text-muted dark:text-pool-light/60">
          {dict.interSchool.division}:
        </span>
        <Link href={filterUrl("division", undefined)} className={!division ? PILL_ACTIVE : PILL_INACTIVE}>
          {dict.interSchool.allDivisions}
        </Link>
        {filterOptions.divisions.map((d) => (
          <Link key={d} href={filterUrl("division", d)} className={division === d ? PILL_ACTIVE : PILL_INACTIVE}>
            {lang === "en" ? `D${d}` : `${d}組`}
          </Link>
        ))}

        <span className="text-pool-border dark:text-pool-border">|</span>

        <span className="text-xs font-medium text-muted dark:text-pool-light/60">
          {dict.leaderboard.gender}:
        </span>
        <Link href={filterUrl("gender", "M")} className={gender === "M" ? PILL_ACTIVE : PILL_INACTIVE}>
          {dict.common.male}
        </Link>
        <Link href={filterUrl("gender", "F")} className={gender === "F" ? PILL_ACTIVE : PILL_INACTIVE}>
          {dict.common.female}
        </Link>
      </div>

      {/* Rankings table */}
      {rankings.length === 0 ? (
        <p className="text-muted dark:text-pool-light/50">{dict.common.noResults}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-pool-border dark:border-pool-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-pool-border bg-pool-surface dark:border-pool-border dark:bg-surface-alt">
                <th className="w-10 px-2 py-2.5 text-center font-semibold text-pool-deep dark:text-pool-light sm:w-12 sm:px-3">
                  {dict.common.place}
                </th>
                <th className="px-2 py-2.5 text-left font-semibold text-pool-deep dark:text-pool-light sm:px-3">
                  {dict.interSchool.school}
                </th>
                <th className="px-2 py-2.5 text-center font-semibold text-pool-deep dark:text-pool-light sm:px-3">
                  {dict.interSchool.gold}
                </th>
                <th className="px-2 py-2.5 text-center font-semibold text-pool-deep dark:text-pool-light sm:px-3">
                  {dict.interSchool.silver}
                </th>
                <th className="px-2 py-2.5 text-center font-semibold text-pool-deep dark:text-pool-light sm:px-3">
                  {dict.interSchool.bronze}
                </th>
                <th className="px-2 py-2.5 text-right font-semibold text-pool-deep dark:text-pool-light sm:px-3">
                  {dict.interSchool.totalPoints}
                </th>
                <th className="hidden px-3 py-2.5 text-right font-semibold text-pool-deep dark:text-pool-light sm:table-cell">
                  {dict.competition.results}
                </th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((school, i) => (
                <tr
                  key={school.club}
                  className={`water-row border-b border-pool-border/50 dark:border-pool-border/50 ${
                    i % 2 === 1 ? "bg-pool-surface/50 dark:bg-surface-alt/30" : ""
                  }`}
                >
                  <td className="px-2 py-2 text-center font-medium sm:px-3">
                    <MedalRank rank={i + 1} />
                  </td>
                  <td className="px-2 py-2 sm:px-3">
                    <Link
                      href={`/${lang}/inter-school/school/${encodeURIComponent(school.club)}`}
                      className="font-medium text-pool-mid hover:text-pool-deep dark:text-pool-light dark:hover:text-white"
                    >
                      {school.club}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-center sm:px-3">
                    {school.gold > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-yellow-100 px-1 text-xs font-bold text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300">
                        {school.gold}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center sm:px-3">
                    {school.silver > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-100 px-1 text-xs font-bold text-gray-500 dark:bg-gray-700/50 dark:text-gray-300">
                        {school.silver}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center sm:px-3">
                    {school.bronze > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1 text-xs font-bold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                        {school.bronze}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right font-mono font-medium text-foreground sm:px-3">
                    {school.total_points}
                  </td>
                  <td className="hidden px-3 py-2 text-right text-muted dark:text-pool-light/60 sm:table-cell">
                    {school.result_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
