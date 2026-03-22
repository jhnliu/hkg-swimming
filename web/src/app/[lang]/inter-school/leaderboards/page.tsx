import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale, getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import {
  getHkssfLeaderboard,
  getHkssfLeaderboardEventKeys,
  getHkssfFilterOptions,
  formatHkssfStroke,
  formatHkssfStrokeZh,
} from "@/lib/db";
import { NavSelect } from "@/components/nav-select";
import { localizedMeta } from "@/lib/seo";

const DEFAULT_EVENT = "freestyle_50_LC";

/** Parse event key like "individual_medley_200_LC" → ["individual_medley", "200"] */
function parseEventKey(key: string): [string, string] {
  const parts = key.split("_");
  // last part is course (LC), second-to-last is distance
  const dist = parts[parts.length - 2];
  const stroke = parts.slice(0, -2).join("_");
  return [stroke, dist];
}

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
    titleKey: `${dict.interSchool.title} — ${dict.interSchool.leaderboards}`,
    descriptionKey: "interSchoolLeaderboardsDescription",
    path: "/inter-school/leaderboards",
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

export default async function HkssfLeaderboardsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{
    event?: string;
    gender?: string;
    ageGroup?: string;
    season?: string;
    division?: string;
  }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { event: eventParam, gender, ageGroup, season, division } = await searchParams;

  const dict = await getDictionary(lang as Locale);
  const requestedEvent = eventParam || DEFAULT_EVENT;
  const filters = { gender, ageGroup, season, division };

  const [eventKeys, filterOptions, optimisticTop] = await Promise.all([
    getHkssfLeaderboardEventKeys(),
    getHkssfFilterOptions(),
    getHkssfLeaderboard(requestedEvent, 25, filters),
  ]);

  const selectedEvent =
    eventParam && eventKeys.includes(eventParam) ? eventParam : DEFAULT_EVENT;

  const top =
    requestedEvent === selectedEvent
      ? optimisticTop
      : await getHkssfLeaderboard(selectedEvent, 25, filters);

  const [selStroke, selDist] = parseEventKey(selectedEvent);

  const eventSet = new Set(eventKeys);
  const distances = [...new Set(eventKeys.map((k) => parseEventKey(k)[1]))]
    .sort((a, b) => parseInt(a) - parseInt(b));
  const strokes = [...new Set(eventKeys.map((k) => parseEventKey(k)[0]))];

  function bestEvent(stroke: string, dist: string): string {
    const exact = `${stroke}_${dist}_LC`;
    if (eventSet.has(exact)) return exact;
    for (const d of distances) {
      const key = `${stroke}_${d}_LC`;
      if (eventSet.has(key)) return key;
    }
    for (const key of eventKeys) {
      if (key.startsWith(stroke + "_")) return key;
    }
    return DEFAULT_EVENT;
  }

  const strokeLabel =
    lang === "zh" ? formatHkssfStrokeZh(selStroke) : formatHkssfStroke(selStroke);

  const hasFilters = !!(gender || ageGroup || season || division);

  function filterUrl(key: string, value: string | undefined): string {
    const p = new URLSearchParams();
    p.set("event", selectedEvent);
    if (gender && key !== "gender") p.set("gender", gender);
    if (ageGroup && key !== "ageGroup") p.set("ageGroup", ageGroup);
    if (season && key !== "season") p.set("season", season);
    if (division && key !== "division") p.set("division", division);
    if (value) p.set(key, value);
    return `/${lang}/inter-school/leaderboards?${p.toString()}`;
  }

  function eventUrl(eventKey: string): string {
    const p = new URLSearchParams();
    p.set("event", eventKey);
    if (gender) p.set("gender", gender);
    if (ageGroup) p.set("ageGroup", ageGroup);
    if (season) p.set("season", season);
    if (division) p.set("division", division);
    return `/${lang}/inter-school/leaderboards?${p.toString()}`;
  }

  const PILL = "rounded-md px-2 py-1 text-xs font-medium transition-colors";
  const PILL_ACTIVE = `${PILL} filter-active`;
  const PILL_INACTIVE = `${PILL} bg-pool-surface text-muted hover:bg-pool-border dark:bg-surface-alt dark:text-pool-light/70 dark:hover:bg-pool-border`;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {dict.interSchool.title} — {dict.interSchool.leaderboards}
        </h1>
        <p className="mt-1 text-sm text-muted dark:text-pool-light/60">
          {lang === "en"
            ? "Top times across inter-school competitions"
            : "學界比賽最佳時間排名"}
        </p>
      </div>

      {/* Event filters — Distance, Stroke */}
      <div className="flex flex-col gap-2 rounded-lg border border-pool-border bg-surface p-3 dark:border-pool-border dark:bg-surface">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-16 shrink-0 text-xs font-medium text-muted dark:text-pool-light/60">
            {lang === "en" ? "Distance" : "距離"}:
          </span>
          {distances.map((d) => {
            const target = bestEvent(selStroke, d);
            return (
              <Link
                key={d}
                href={eventUrl(target)}
                className={d === selDist ? PILL_ACTIVE : PILL_INACTIVE}
              >
                {d}
              </Link>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-16 shrink-0 text-xs font-medium text-muted dark:text-pool-light/60">
            {lang === "en" ? "Stroke" : "泳式"}:
          </span>
          {strokes.map((s) => {
            const target = bestEvent(s, selDist);
            return (
              <Link
                key={s}
                href={eventUrl(target)}
                className={s === selStroke ? PILL_ACTIVE : PILL_INACTIVE}
              >
                {lang === "zh" ? formatHkssfStrokeZh(s) : formatHkssfStroke(s)}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Gender / Grade / Season / Division filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted dark:text-pool-light/60">
          {dict.leaderboard.filters}:
        </span>

        {/* Gender */}
        <div className="flex items-center gap-1">
          <Link href={filterUrl("gender", undefined)} className={!gender ? PILL_ACTIVE : PILL_INACTIVE}>
            {lang === "en" ? "All" : "全部"}
          </Link>
          <Link href={filterUrl("gender", "M")} className={gender === "M" ? PILL_ACTIVE : PILL_INACTIVE}>
            {dict.common.male}
          </Link>
          <Link href={filterUrl("gender", "F")} className={gender === "F" ? PILL_ACTIVE : PILL_INACTIVE}>
            {dict.common.female}
          </Link>
        </div>

        <span className="hidden text-pool-border dark:text-pool-border sm:inline">|</span>

        {/* Grade */}
        <div className="flex items-center gap-1">
          <NavSelect
            id="ageGroup"
            label={dict.interSchool.ageGroup}
            value={ageGroup || ""}
            options={[
              { value: "", label: lang === "en" ? "All grades" : "所有級別" },
              ...filterOptions.ageGroups.map((ag) => ({
                value: ag,
                label: ag === "A" ? dict.interSchool.gradeA : ag === "B" ? dict.interSchool.gradeB : dict.interSchool.gradeC,
              })),
            ]}
            urlMap={Object.fromEntries([
              ["", filterUrl("ageGroup", undefined)],
              ...filterOptions.ageGroups.map((ag) => [ag, filterUrl("ageGroup", ag)]),
            ])}
          />
        </div>

        <span className="hidden text-pool-border dark:text-pool-border sm:inline">|</span>

        {/* Season */}
        <div className="flex items-center gap-1">
          <NavSelect
            id="season"
            label={dict.interSchool.season}
            value={season || ""}
            options={[
              { value: "", label: dict.interSchool.allSeasons },
              ...filterOptions.seasons.map((s) => ({ value: s, label: seasonDisplay(s) })),
            ]}
            urlMap={Object.fromEntries([
              ["", filterUrl("season", undefined)],
              ...filterOptions.seasons.map((s) => [s, filterUrl("season", s)]),
            ])}
          />
        </div>

        <span className="hidden text-pool-border dark:text-pool-border sm:inline">|</span>

        {/* Division */}
        <div className="flex items-center gap-1">
          <NavSelect
            id="division"
            label={dict.interSchool.division}
            value={division || ""}
            options={[
              { value: "", label: dict.interSchool.allDivisions },
              ...filterOptions.divisions.map((d) => ({
                value: d,
                label: lang === "en" ? `Division ${d}` : `第${d}組`,
              })),
            ]}
            urlMap={Object.fromEntries([
              ["", filterUrl("division", undefined)],
              ...filterOptions.divisions.map((d) => [d, filterUrl("division", d)]),
            ])}
          />
        </div>

        {hasFilters && (
          <>
            <span className="hidden text-pool-border dark:text-pool-border sm:inline">|</span>
            <Link
              href={`/${lang}/inter-school/leaderboards?event=${selectedEvent}`}
              className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              {lang === "en" ? "Clear all" : "清除篩選"}
            </Link>
          </>
        )}
      </div>

      {/* Leaderboard */}
      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">
          {selDist} {strokeLabel}{" "}
          <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300">
            LC
          </span>
          {gender && (
            <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
              {gender === "M" ? dict.common.male : dict.common.female}
            </span>
          )}
          {ageGroup && (
            <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
              {ageGroup === "A" ? dict.interSchool.gradeA : ageGroup === "B" ? dict.interSchool.gradeB : dict.interSchool.gradeC}
            </span>
          )}
          {season && (
            <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300">
              {seasonDisplay(season)}
            </span>
          )}
          {division && (
            <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
              {lang === "en" ? `D${division}` : `${division}組`}
            </span>
          )}
        </h2>

        {top.length === 0 ? (
          <p className="text-muted dark:text-pool-light/50">
            {dict.common.noResults}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-pool-border dark:border-pool-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-pool-border bg-pool-surface dark:border-pool-border dark:bg-surface-alt">
                  <th className="w-10 px-2 py-2.5 text-center font-semibold text-pool-deep dark:text-pool-light sm:w-12 sm:px-3">
                    {dict.common.place}
                  </th>
                  <th className="px-2 py-2.5 text-left font-semibold text-pool-deep dark:text-pool-light sm:px-3">
                    {dict.common.name}
                  </th>
                  <th className="hidden px-3 py-2.5 text-center font-semibold text-pool-deep dark:text-pool-light sm:table-cell">
                    {dict.interSchool.school}
                  </th>
                  <th className="px-2 py-2.5 text-right font-semibold text-pool-deep dark:text-pool-light sm:px-3">
                    {dict.swimmer.time}
                  </th>
                  <th className="hidden px-3 py-2.5 text-right font-semibold text-pool-deep dark:text-pool-light sm:table-cell">
                    {dict.swimmer.date}
                  </th>
                </tr>
              </thead>
              <tbody>
                {top.map((pb, i) => (
                  <tr
                    key={`${pb.swimmer_name}-${pb.club}-${i}`}
                    className={`water-row border-b border-pool-border/50 dark:border-pool-border/50 ${
                      i % 2 === 1 ? "bg-pool-surface/50 dark:bg-surface-alt/30" : ""
                    }`}
                  >
                    <td className="px-2 py-2 text-center font-medium sm:px-3">
                      <MedalRank rank={i + 1} />
                    </td>
                    <td className="px-2 py-2 sm:px-3">
                      <span className="font-medium text-foreground dark:text-pool-light">
                        {pb.swimmer_name}
                      </span>
                      <div className="mt-0.5 text-xs text-muted dark:text-pool-light/50 sm:hidden">
                        <Link
                          href={`/${lang}/inter-school/school/${encodeURIComponent(pb.club)}`}
                          className="hover:text-pool-mid dark:hover:text-pool-light"
                        >
                          {pb.club}
                        </Link>
                      </div>
                    </td>
                    <td className="hidden px-3 py-2 text-center sm:table-cell">
                      <Link
                        href={`/${lang}/inter-school/school/${encodeURIComponent(pb.club)}`}
                        className="font-medium text-foreground/80 hover:text-pool-mid dark:hover:text-pool-light"
                      >
                        {pb.club}
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-right font-mono font-medium tracking-wider text-foreground timing-display sm:px-3">
                      {pb.time}
                    </td>
                    <td className="hidden px-3 py-2 text-right text-muted dark:text-pool-light/60 sm:table-cell">
                      {pb.date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
