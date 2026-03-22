import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale, getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import {
  getHkssfCompetitionsPaginated,
  getHkssfFilterOptions,
  divisionLabel,
} from "@/lib/db";
import { localizedMeta } from "@/lib/seo";

const PAGE_SIZE = 20;

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
    titleKey: dict.interSchool.title,
    descriptionKey: "interSchoolDescription",
    path: "/inter-school",
  });
}

function seasonDisplay(code: string): string {
  if (code.length !== 4) return code;
  const y1 = parseInt("20" + code.slice(0, 2));
  const y2 = parseInt("20" + code.slice(2, 4));
  return `${y1}-${y2}`;
}

export default async function InterSchoolPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ page?: string; season?: string; division?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const { page: pageParam, season, division } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1") || 1);

  const [dict, filterOptions, { competitions, total }] = await Promise.all([
    getDictionary(lang as Locale),
    getHkssfFilterOptions(),
    getHkssfCompetitionsPaginated(page, PAGE_SIZE, { season, division }),
  ]);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const PILL = "rounded-md px-2 py-1 text-xs font-medium transition-colors";
  const PILL_ACTIVE = `${PILL} filter-active`;
  const PILL_INACTIVE = `${PILL} bg-pool-surface text-muted hover:bg-pool-border dark:bg-surface-alt dark:text-pool-light/70 dark:hover:bg-pool-border`;

  function filterUrl(key: string, value: string | undefined): string {
    const p = new URLSearchParams();
    if (season && key !== "season") p.set("season", season);
    if (division && key !== "division") p.set("division", division);
    if (value) p.set(key, value);
    return `/${lang}/inter-school${p.toString() ? `?${p.toString()}` : ""}`;
  }

  // Group competitions by season
  const groups = new Map<string, typeof competitions>();
  for (const comp of competitions) {
    const s = seasonDisplay(comp.season);
    if (!groups.has(s)) groups.set(s, []);
    groups.get(s)!.push(comp);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {dict.interSchool.title}
        </h1>
        <p className="mt-1 text-sm text-muted dark:text-pool-light/60">
          {dict.interSchool.subtitle}
        </p>
      </div>

      {/* Quick nav */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/${lang}/inter-school/rankings${season ? `?season=${season}` : ""}`}
          className="rounded-lg border border-pool-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:border-pool-mid hover:shadow-md dark:border-pool-border dark:bg-surface dark:hover:border-pool-light"
        >
          {dict.interSchool.rankings}
        </Link>
        <Link
          href={`/${lang}/inter-school/leaderboards?event=freestyle_50m_LC`}
          className="rounded-lg border border-pool-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:border-pool-mid hover:shadow-md dark:border-pool-border dark:bg-surface dark:hover:border-pool-light"
        >
          {dict.interSchool.leaderboards}
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted dark:text-pool-light/60">
          {dict.interSchool.season}:
        </span>
        <Link href={filterUrl("season", undefined)} className={!season ? PILL_ACTIVE : PILL_INACTIVE}>
          {dict.interSchool.allSeasons}
        </Link>
        {filterOptions.seasons.map((s) => (
          <Link key={s} href={filterUrl("season", s)} className={season === s ? PILL_ACTIVE : PILL_INACTIVE}>
            {seasonDisplay(s)}
          </Link>
        ))}

        <span className="hidden text-pool-border dark:text-pool-border sm:inline">|</span>

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
      </div>

      {/* Competition list */}
      {competitions.length === 0 ? (
        <p className="text-muted dark:text-pool-light/50">{dict.common.noResults}</p>
      ) : (
        [...groups.entries()].map(([seasonLabel, comps]) => (
          <section key={seasonLabel}>
            <h2 className="lane-line mb-3 text-lg font-semibold text-foreground">
              {seasonLabel}
            </h2>
            <div className="flex flex-col gap-2">
              {comps.map((comp, i) => (
                <Link
                  key={`${comp.id}-${i}`}
                  href={`/${lang}/inter-school/competition/${comp.id}`}
                  className="flex flex-col gap-2 rounded-lg border border-pool-border bg-surface px-4 py-3 hover:border-pool-mid hover:shadow-md sm:flex-row sm:items-center sm:justify-between dark:border-pool-border dark:bg-surface dark:hover:border-pool-light"
                >
                  <span className="font-medium text-foreground">
                    {comp.name}
                  </span>
                  <div className="flex items-center gap-2 text-sm text-muted dark:text-pool-light/60">
                    <span>{comp.date}</span>
                    <span className="rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-900/50 dark:text-sky-300">
                      LC
                    </span>
                    <span className="rounded bg-pool-surface px-1.5 py-0.5 text-xs font-medium text-muted dark:bg-surface-alt dark:text-pool-light/70">
                      {divisionLabel(comp.division, comp.region, lang as "en" | "zh")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 pt-4" aria-label="Pagination">
          {page > 1 && (
            <Link
              href={`/${lang}/inter-school?page=${page - 1}${season ? `&season=${season}` : ""}${division ? `&division=${division}` : ""}`}
              className="rounded-lg border border-pool-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:border-pool-mid hover:shadow-md dark:border-pool-border dark:bg-surface dark:hover:border-pool-light"
            >
              {lang === "zh" ? "上一頁" : "Previous"}
            </Link>
          )}
          <span className="px-3 py-2 text-sm text-muted">
            {lang === "zh"
              ? `第 ${page} / ${totalPages} 頁`
              : `Page ${page} of ${totalPages}`}
          </span>
          {page < totalPages && (
            <Link
              href={`/${lang}/inter-school?page=${page + 1}${season ? `&season=${season}` : ""}${division ? `&division=${division}` : ""}`}
              className="rounded-lg border border-pool-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:border-pool-mid hover:shadow-md dark:border-pool-border dark:bg-surface dark:hover:border-pool-light"
            >
              {lang === "zh" ? "下一頁" : "Next"}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
