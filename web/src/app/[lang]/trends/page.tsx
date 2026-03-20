import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale, getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import {
  getBiggestImprovers,
  getBreakthroughSwims,
  getTrendFilterOptions,
  formatStroke,
  formatStrokeZh,
} from "@/lib/db";

function formatDuration(days: number, lang: "en" | "zh"): string {
  if (days < 30) return lang === "en" ? `${days}d` : `${days}日`;
  const months = Math.round(days / 30);
  if (months < 12) return lang === "en" ? `${months}mo` : `${months}個月`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return lang === "en" ? `${years}y` : `${years}年`;
  return lang === "en" ? `${years}y ${rem}mo` : `${years}年${rem}個月`;
}

const STANDARD_LABELS: Record<string, { en: string; zh: string }> = {
  D1: { en: "Division 1 Qualifying", zh: "第一組資格" },
  D2: { en: "Division 2 Qualifying", zh: "第二組資格" },
  QT: { en: "Qualifying Time", zh: "達標時間" },
  AQT: { en: "A Qualifying Time", zh: "A達標時間" },
  A: { en: "World Aquatics A", zh: "世界泳聯A標" },
  B: { en: "World Aquatics B", zh: "世界泳聯B標" },
  H: { en: "HK Record", zh: "香港紀錄" },
  J: { en: "Junior Record", zh: "青少年紀錄" },
};

export default async function TrendsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{
    stroke?: string;
    course?: string;
    gender?: string;
    club?: string;
  }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { stroke, course, gender, club } = await searchParams;

  const dict = await getDictionary(lang as Locale);
  const filterOptions = await getTrendFilterOptions();

  const improvers = await getBiggestImprovers(30, { stroke, course, gender, club });
  const breakthroughs = await getBreakthroughSwims(30);

  const hasFilters = !!(stroke || course || gender || club);

  function filterUrl(key: string, value: string | undefined): string {
    const p = new URLSearchParams();
    if (stroke && key !== "stroke") p.set("stroke", stroke);
    if (course && key !== "course") p.set("course", course);
    if (gender && key !== "gender") p.set("gender", gender);
    if (club && key !== "club") p.set("club", club);
    if (value) p.set(key, value);
    const qs = p.toString();
    return `/${lang}/trends${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {dict.nav.trends}
        </h1>
        <p className="mt-1 text-sm text-muted dark:text-pool-light/60">
          {lang === "en"
            ? "Performance trends across Hong Kong swimming"
            : "香港游泳表現趨勢"}
        </p>
      </div>

      {/* Biggest Improvers */}
      <section>
        <h2 className="lane-line mb-1 text-xl font-semibold text-foreground">
          {lang === "en" ? "Biggest Improvers" : "進步最大泳手"}
        </h2>
        <p className="mb-4 text-sm text-muted dark:text-pool-light/60">
          {lang === "en"
            ? "Largest % time drop in the same event over the last 12 months"
            : "過去12個月在同一項目中時間進步百分比最大的泳手"}
        </p>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted dark:text-pool-light/60">
            {dict.leaderboard.filters}:
          </span>

          {/* Stroke */}
          <div className="flex items-center gap-1">
            <Link
              href={filterUrl("stroke", undefined)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                !stroke
                  ? "filter-active"
                  : "bg-pool-surface text-muted hover:bg-pool-border dark:bg-surface-alt dark:text-pool-light/70"
              }`}
            >
              {lang === "en" ? "All strokes" : "所有泳式"}
            </Link>
            {filterOptions.strokes.map((s) => (
              <Link
                key={s}
                href={filterUrl("stroke", s)}
                className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  stroke === s
                    ? "filter-active"
                    : "bg-pool-surface text-muted hover:bg-pool-border dark:bg-surface-alt dark:text-pool-light/70"
                }`}
              >
                {lang === "zh" ? formatStrokeZh(s) : formatStroke(s)}
              </Link>
            ))}
          </div>

          <span className="text-pool-border dark:text-pool-border">|</span>

          {/* Course */}
          <div className="flex items-center gap-1">
            <Link
              href={filterUrl("course", undefined)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                !course
                  ? "filter-active"
                  : "bg-pool-surface text-muted hover:bg-pool-border dark:bg-surface-alt dark:text-pool-light/70"
              }`}
            >
              {lang === "en" ? "Both" : "長短池"}
            </Link>
            {filterOptions.courses.map((c) => (
              <Link
                key={c}
                href={filterUrl("course", c)}
                className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  course === c
                    ? "filter-active"
                    : "bg-pool-surface text-muted hover:bg-pool-border dark:bg-surface-alt dark:text-pool-light/70"
                }`}
              >
                {c === "LC" ? dict.common.lc : dict.common.sc}
              </Link>
            ))}
          </div>

          <span className="text-pool-border dark:text-pool-border">|</span>

          {/* Gender */}
          <div className="flex items-center gap-1">
            <Link
              href={filterUrl("gender", undefined)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                !gender
                  ? "filter-active"
                  : "bg-pool-surface text-muted hover:bg-pool-border dark:bg-surface-alt dark:text-pool-light/70"
              }`}
            >
              {lang === "en" ? "All" : "全部"}
            </Link>
            {filterOptions.genders.map((g) => (
              <Link
                key={g}
                href={filterUrl("gender", g)}
                className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  gender === g
                    ? "filter-active"
                    : "bg-pool-surface text-muted hover:bg-pool-border dark:bg-surface-alt dark:text-pool-light/70"
                }`}
              >
                {g}
              </Link>
            ))}
          </div>

          {hasFilters && (
            <>
              <span className="text-pool-border dark:text-pool-border">|</span>
              <Link
                href={`/${lang}/trends`}
                className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                {lang === "en" ? "Clear all" : "清除篩選"}
              </Link>
            </>
          )}
        </div>

        {improvers.length === 0 ? (
          <p className="text-muted dark:text-pool-light/50">
            {dict.common.noResults}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-pool-border dark:border-pool-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pool-border bg-pool-surface dark:border-pool-border dark:bg-surface-alt">
                  <th className="w-10 px-3 py-2.5 text-center font-semibold text-pool-deep dark:text-pool-light">
                    #
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold text-pool-deep dark:text-pool-light">
                    {dict.common.name}
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold text-pool-deep dark:text-pool-light">
                    {dict.common.team}
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold text-pool-deep dark:text-pool-light">
                    {lang === "en" ? "Event" : "項目"}
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold text-pool-deep dark:text-pool-light">
                    {lang === "en" ? "Before" : "之前"}
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold text-pool-deep dark:text-pool-light">
                    {lang === "en" ? "After" : "之後"}
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold text-pool-deep dark:text-pool-light">
                    {lang === "en" ? "Drop" : "進步"}
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold text-pool-deep dark:text-pool-light">
                    {lang === "en" ? "Over" : "歷時"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {improvers.map((imp, i) => {
                  const timeDrop = imp.old_seconds - imp.new_seconds;
                  return (
                    <tr
                      key={`${imp.swimmer_id}_${imp.distance}_${imp.stroke}_${imp.course}_${i}`}
                      className={`water-row border-b border-pool-border/50 dark:border-pool-border/50 ${
                        i % 2 === 1 ? "bg-pool-surface/50 dark:bg-surface-alt/30" : ""
                      }`}
                    >
                      <td className="px-3 py-2 text-center text-muted dark:text-pool-light/60">
                        {i + 1}
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/${lang}/swimmer/${encodeURIComponent(imp.swimmer_id)}`}
                          className="font-medium text-pool-mid hover:text-pool-deep dark:text-pool-light dark:hover:text-white"
                        >
                          {imp.swimmer_name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Link
                          href={`/${lang}/club/${imp.club}`}
                          className="font-medium text-foreground/80 hover:text-pool-mid dark:hover:text-pool-light"
                        >
                          {imp.club}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {imp.distance}m{" "}
                        {lang === "zh"
                          ? formatStrokeZh(imp.stroke)
                          : formatStroke(imp.stroke)}{" "}
                        <span className="text-xs text-muted/60">{imp.course}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-muted timing-display dark:text-pool-light/60">
                        <span title={imp.old_date}>{imp.old_time}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-medium text-foreground timing-display">
                        <span title={imp.new_date}>{imp.new_time}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          -{imp.improvement_pct}%
                        </span>
                        <span className="ml-1 text-xs text-muted/60 dark:text-pool-light/40">
                          ({timeDrop.toFixed(2)}s)
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-muted dark:text-pool-light/60">
                        {formatDuration(imp.days_between, lang as "en" | "zh")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Breakthrough Swims */}
      <section>
        <h2 className="lane-line mb-1 text-xl font-semibold text-foreground">
          {lang === "en" ? "Breakthrough Swims" : "突破性成績"}
        </h2>
        <p className="mb-4 text-sm text-muted dark:text-pool-light/60">
          {lang === "en"
            ? "Swimmers who recently achieved a qualifying standard for the first time in an event"
            : "最近在某項目首次達到資格標準的泳手"}
        </p>

        {breakthroughs.length === 0 ? (
          <p className="text-muted dark:text-pool-light/50">
            {dict.common.noResults}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-pool-border dark:border-pool-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pool-border bg-pool-surface dark:border-pool-border dark:bg-surface-alt">
                  <th className="px-3 py-2.5 text-left font-semibold text-pool-deep dark:text-pool-light">
                    {dict.common.name}
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold text-pool-deep dark:text-pool-light">
                    {dict.common.team}
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold text-pool-deep dark:text-pool-light">
                    {dict.swimmer.age}
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold text-pool-deep dark:text-pool-light">
                    {lang === "en" ? "Event" : "項目"}
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold text-pool-deep dark:text-pool-light">
                    {dict.swimmer.time}
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold text-pool-deep dark:text-pool-light">
                    {lang === "en" ? "Qualified For" : "達標項目"}
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold text-pool-deep dark:text-pool-light">
                    {dict.swimmer.date}
                  </th>
                </tr>
              </thead>
              <tbody>
                {breakthroughs.map((b, i) => {
                  const stdLabel =
                    STANDARD_LABELS[b.time_standard]?.[lang as "en" | "zh"] ??
                    b.time_standard;
                  return (
                    <tr
                      key={`${b.swimmer_id}_${b.distance}_${b.stroke}_${b.course}_${b.date}_${i}`}
                      className={`water-row border-b border-pool-border/50 dark:border-pool-border/50 ${
                        i % 2 === 1 ? "bg-pool-surface/50 dark:bg-surface-alt/30" : ""
                      }`}
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/${lang}/swimmer/${encodeURIComponent(b.swimmer_id)}`}
                          className="font-medium text-pool-mid hover:text-pool-deep dark:text-pool-light dark:hover:text-white"
                        >
                          {b.swimmer_name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Link
                          href={`/${lang}/club/${b.club}`}
                          className="font-medium text-foreground/80 hover:text-pool-mid dark:hover:text-pool-light"
                        >
                          {b.club}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-center text-muted dark:text-pool-light/60">
                        {b.age}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {b.distance}m{" "}
                        {lang === "zh"
                          ? formatStrokeZh(b.stroke)
                          : formatStroke(b.stroke)}{" "}
                        <span className="text-xs text-muted/60">{b.course}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-medium text-foreground timing-display">
                        {b.finals_time}
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                          {b.time_standard}
                        </span>
                        <span className="ml-2 text-xs text-muted dark:text-pool-light/60">
                          {stdLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-muted dark:text-pool-light/60">
                        {b.date}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
