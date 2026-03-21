import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale, getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import {
  getHkssfSchoolDetail,
  getHkssfFilterOptions,
  formatHkssfStroke,
  formatHkssfStrokeZh,
  divisionLabel,
} from "@/lib/db";
import { Breadcrumb } from "@/components/breadcrumb";
import { alternatesForPath, ogMeta } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; code: string }>;
}): Promise<Metadata> {
  const { lang, code } = await params;
  const locale = (isLocale(lang) ? lang : "en") as Locale;
  const schoolCode = decodeURIComponent(code);
  const path = `/inter-school/school/${code}`;
  return {
    title: `${schoolCode} — Inter-School Swimming`,
    description: `${schoolCode} inter-school swimming results, medals, and rankings.`,
    alternates: alternatesForPath(path),
    openGraph: ogMeta({
      title: `${schoolCode} — Inter-School Swimming`,
      description: `${schoolCode} inter-school swimming results, medals, and rankings.`,
      path,
      lang: locale,
    }),
  };
}

function seasonDisplay(code: string): string {
  if (code.length !== 4) return code;
  const y1 = parseInt("20" + code.slice(0, 2));
  const y2 = parseInt("20" + code.slice(2, 4));
  return `${y1}-${y2}`;
}

export default async function SchoolDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; code: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { lang, code } = await params;
  if (!isLocale(lang)) notFound();

  const schoolCode = decodeURIComponent(code);
  const { season } = await searchParams;

  const [dict, filterOptions, { results, totals }] = await Promise.all([
    getDictionary(lang as Locale),
    getHkssfFilterOptions(),
    getHkssfSchoolDetail(schoolCode, season),
  ]);

  if (results.length === 0 && !season) notFound();

  // Group results by competition
  const byCompetition = new Map<string, typeof results>();
  for (const r of results) {
    if (!byCompetition.has(r.competition_id))
      byCompetition.set(r.competition_id, []);
    byCompetition.get(r.competition_id)!.push(r);
  }

  // Top performers: swimmers with most golds
  const swimmerMedals = new Map<string, { gold: number; silver: number; bronze: number; count: number }>();
  for (const r of results) {
    if (!r.swimmer_name) continue;
    const m = swimmerMedals.get(r.swimmer_name) || { gold: 0, silver: 0, bronze: 0, count: 0 };
    m.count++;
    if (r.place === 1) m.gold++;
    else if (r.place === 2) m.silver++;
    else if (r.place === 3) m.bronze++;
    swimmerMedals.set(r.swimmer_name, m);
  }
  const topPerformers = [...swimmerMedals.entries()]
    .sort((a, b) => b[1].gold - a[1].gold || b[1].silver - a[1].silver || b[1].count - a[1].count)
    .slice(0, 10);

  const PILL = "rounded-md px-2 py-1 text-xs font-medium transition-colors";
  const PILL_ACTIVE = `${PILL} filter-active`;
  const PILL_INACTIVE = `${PILL} bg-pool-surface text-muted hover:bg-pool-border dark:bg-surface-alt dark:text-pool-light/70 dark:hover:bg-pool-border`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Breadcrumb
          lang={lang as Locale}
          items={[
            { label: dict.interSchool.title, href: `/${lang}/inter-school` },
            { label: dict.interSchool.rankings, href: `/${lang}/inter-school/rankings` },
            { label: schoolCode },
          ]}
        />
        <h1 className="text-3xl font-bold text-foreground">
          {schoolCode}
        </h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-pool-border bg-surface p-4 dark:border-pool-border dark:bg-surface">
          <div className="text-2xl font-bold text-foreground">{totals.total_results}</div>
          <div className="text-xs text-muted dark:text-pool-light/60">{dict.competition.results}</div>
        </div>
        <div className="rounded-lg border border-pool-border bg-surface p-4 dark:border-pool-border dark:bg-surface">
          <div className="text-2xl font-bold text-foreground">{totals.seasons}</div>
          <div className="text-xs text-muted dark:text-pool-light/60">{dict.interSchool.season}</div>
        </div>
        <div className="rounded-lg border border-pool-border bg-surface p-4 dark:border-pool-border dark:bg-surface">
          <div className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-yellow-100 text-xs font-bold text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300">{totals.gold}</span>
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500 dark:bg-gray-700/50 dark:text-gray-300">{totals.silver}</span>
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">{totals.bronze}</span>
          </div>
          <div className="text-xs text-muted dark:text-pool-light/60">{dict.interSchool.medals}</div>
        </div>
        <div className="rounded-lg border border-pool-border bg-surface p-4 dark:border-pool-border dark:bg-surface">
          <div className="text-2xl font-bold text-foreground">{totals.total_points}</div>
          <div className="text-xs text-muted dark:text-pool-light/60">{dict.interSchool.totalPoints}</div>
        </div>
      </div>

      {/* Season filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted dark:text-pool-light/60">
          {dict.interSchool.season}:
        </span>
        <Link
          href={`/${lang}/inter-school/school/${encodeURIComponent(schoolCode)}`}
          className={!season ? PILL_ACTIVE : PILL_INACTIVE}
        >
          {dict.interSchool.allSeasons}
        </Link>
        {filterOptions.seasons.map((s) => (
          <Link
            key={s}
            href={`/${lang}/inter-school/school/${encodeURIComponent(schoolCode)}?season=${s}`}
            className={season === s ? PILL_ACTIVE : PILL_INACTIVE}
          >
            {seasonDisplay(s)}
          </Link>
        ))}
      </div>

      {/* Top performers */}
      {topPerformers.length > 0 && (
        <section>
          <h2 className="lane-line mb-3 text-xl font-semibold text-foreground">
            {dict.interSchool.topPerformers}
          </h2>
          <div className="overflow-x-auto rounded-lg border border-pool-border dark:border-pool-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pool-border bg-pool-surface dark:border-pool-border dark:bg-surface-alt">
                  <th className="px-3 py-2 text-left font-semibold text-pool-deep dark:text-pool-light">
                    {dict.common.name}
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-pool-deep dark:text-pool-light">
                    {dict.interSchool.gold}
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-pool-deep dark:text-pool-light">
                    {dict.interSchool.silver}
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-pool-deep dark:text-pool-light">
                    {dict.interSchool.bronze}
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-pool-deep dark:text-pool-light">
                    {dict.competition.results}
                  </th>
                </tr>
              </thead>
              <tbody>
                {topPerformers.map(([name, m], i) => (
                  <tr
                    key={name}
                    className={`border-b border-pool-border/50 ${
                      i % 2 === 1 ? "bg-pool-surface/50 dark:bg-surface-alt/30" : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-medium text-foreground dark:text-pool-light">
                      {name}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {m.gold > 0 && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-yellow-100 px-1 text-xs font-bold text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300">
                          {m.gold}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {m.silver > 0 && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-100 px-1 text-xs font-bold text-gray-500 dark:bg-gray-700/50 dark:text-gray-300">
                          {m.silver}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {m.bronze > 0 && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1 text-xs font-bold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                          {m.bronze}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-muted dark:text-pool-light/60">
                      {m.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Results by competition */}
      <section>
        <h2 className="lane-line mb-3 text-xl font-semibold text-foreground">
          {dict.interSchool.schoolResults}
        </h2>
        {results.length === 0 ? (
          <p className="text-muted dark:text-pool-light/50">{dict.common.noResults}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {[...byCompetition.entries()].map(([compId, compResults]) => {
              const first = compResults[0];
              return (
                <div key={compId}>
                  <h3 className="mb-2 text-sm font-semibold text-foreground dark:text-pool-light">
                    <Link
                      href={`/${lang}/inter-school/competition/${compId}`}
                      className="hover:text-pool-mid dark:hover:text-pool-light"
                    >
                      {first.competition_name}
                    </Link>
                    <span className="ml-2 text-xs font-normal text-muted dark:text-pool-light/50">
                      {first.date} · {divisionLabel(first.division, first.region, lang as "en" | "zh")}
                    </span>
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-pool-border dark:border-pool-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-pool-border bg-pool-surface dark:border-pool-border dark:bg-surface-alt">
                          <th className="px-2 py-1.5 text-left text-xs font-semibold text-pool-deep dark:text-pool-light">
                            {dict.competition.event}
                          </th>
                          <th className="px-2 py-1.5 text-left text-xs font-semibold text-pool-deep dark:text-pool-light">
                            {dict.common.name}
                          </th>
                          <th className="w-10 px-2 py-1.5 text-center text-xs font-semibold text-pool-deep dark:text-pool-light">
                            {dict.common.place}
                          </th>
                          <th className="px-2 py-1.5 text-right text-xs font-semibold text-pool-deep dark:text-pool-light">
                            {dict.common.finalsTime}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {compResults.map((r, i) => {
                          const strokeLabel = lang === "zh"
                            ? formatHkssfStrokeZh(r.stroke)
                            : formatHkssfStroke(r.stroke);
                          return (
                            <tr
                              key={i}
                              className={`border-b border-pool-border/50 ${
                                i % 2 === 1 ? "bg-pool-surface/50 dark:bg-surface-alt/30" : ""
                              }`}
                            >
                              <td className="px-2 py-1.5 text-xs text-muted dark:text-pool-light/60">
                                {r.distance} {strokeLabel} ({r.gender}{r.age_group})
                              </td>
                              <td className="px-2 py-1.5 text-xs font-medium text-foreground dark:text-pool-light">
                                {r.swimmer_name}
                              </td>
                              <td className="px-2 py-1.5 text-center text-xs text-muted dark:text-pool-light/50">
                                {r.place ?? "—"}
                              </td>
                              <td className="px-2 py-1.5 text-right font-mono text-xs text-foreground timing-display">
                                {r.finals_time || r.time_standard || "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
