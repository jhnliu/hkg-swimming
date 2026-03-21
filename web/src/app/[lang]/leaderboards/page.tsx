import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale, getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import {
  getLeaderboard,
  getLeaderboardEventKeys,
  getLeaderboardFilterOptions,
  formatStroke,
  formatStrokeZh,
  getClubName,
} from "@/lib/db";
import { NavSelect } from "@/components/nav-select";
import { localizedMeta } from "@/lib/seo";

const DEFAULT_EVENT = "Freestyle_100_LC";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang as Locale);
  return localizedMeta({ lang: lang as Locale, dict, titleKey: dict.leaderboard.title, descriptionKey: "leaderboardsDescription", path: "/leaderboards" });
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

export default async function LeaderboardsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{
    event?: string;
    gender?: string;
    ageGroup?: string;
    season?: string;
    compType?: string;
  }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { event: eventParam, gender, ageGroup, season, compType } = await searchParams;

  const dict = await getDictionary(lang as Locale);
  const requestedEvent = eventParam || DEFAULT_EVENT;
  const validCompType = compType === "masters" || compType === "local" ? compType : undefined;
  const filters = { gender, ageGroup, season, compType: validCompType };

  // Fetch all data in parallel — optimistically fetch leaderboard for requested event
  const [eventKeys, filterOptions, optimisticTop] = await Promise.all([
    getLeaderboardEventKeys(),
    getLeaderboardFilterOptions(),
    getLeaderboard(requestedEvent, 25, filters),
  ]);

  const selectedEvent =
    eventParam && eventKeys.includes(eventParam) ? eventParam : DEFAULT_EVENT;

  // If the requested event was invalid, re-fetch with the corrected default
  const top =
    requestedEvent === selectedEvent
      ? optimisticTop
      : await getLeaderboard(selectedEvent, 25, filters);

  const [selStroke, selDist, selCourse] = selectedEvent.split("_");

  // Extract unique distances, strokes, courses from available event keys
  const eventSet = new Set(eventKeys);
  const distances = [...new Set(eventKeys.map((k) => k.split("_")[1]))]
    .sort((a, b) => parseInt(a) - parseInt(b));
  const strokes = [...new Set(eventKeys.map((k) => k.split("_")[0]))];
  const courses = [...new Set(eventKeys.map((k) => k.split("_")[2]))].sort();

  // Find best matching event when user changes one dimension
  function bestEvent(stroke: string, dist: string, course: string): string {
    // Try exact match first
    const exact = `${stroke}_${dist}_${course}`;
    if (eventSet.has(exact)) return exact;
    // Try same stroke+course with closest distance
    for (const d of distances) {
      const key = `${stroke}_${d}_${course}`;
      if (eventSet.has(key)) return key;
    }
    // Try same stroke with any course/distance
    for (const key of eventKeys) {
      if (key.startsWith(stroke + "_")) return key;
    }
    return DEFAULT_EVENT;
  }

  const strokeLabel =
    lang === "zh" ? formatStrokeZh(selStroke) : formatStroke(selStroke);

  const hasFilters = !!(gender || ageGroup || season || validCompType);

  function filterUrl(key: string, value: string | undefined): string {
    const p = new URLSearchParams();
    p.set("event", selectedEvent);
    if (gender && key !== "gender") p.set("gender", gender);
    if (ageGroup && key !== "ageGroup") p.set("ageGroup", ageGroup);
    if (season && key !== "season") p.set("season", season);
    if (validCompType && key !== "compType") p.set("compType", validCompType);
    if (value) p.set(key, value);
    return `/${lang}/leaderboards?${p.toString()}`;
  }

  function eventUrl(eventKey: string): string {
    const p = new URLSearchParams();
    p.set("event", eventKey);
    if (gender) p.set("gender", gender);
    if (ageGroup) p.set("ageGroup", ageGroup);
    if (season) p.set("season", season);
    if (validCompType) p.set("compType", validCompType);
    return `/${lang}/leaderboards?${p.toString()}`;
  }

  const PILL = "rounded-md px-2 py-1 text-xs font-medium transition-colors";
  const PILL_ACTIVE = `${PILL} filter-active`;
  const PILL_INACTIVE = `${PILL} bg-pool-surface text-muted hover:bg-pool-border dark:bg-surface-alt dark:text-pool-light/70 dark:hover:bg-pool-border`;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {dict.leaderboard.title}
        </h1>
        <p className="mt-1 text-sm text-muted dark:text-pool-light/60">
          {lang === "en"
            ? "Top personal bests across all competitions"
            : "所有比賽個人最佳排名"}
        </p>
      </div>

      {/* Event filters — Distance, Stroke, Course */}
      <div className="flex flex-col gap-2 rounded-lg border border-pool-border bg-surface p-3 dark:border-pool-border dark:bg-surface">
        {/* Distance */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-16 shrink-0 text-xs font-medium text-muted dark:text-pool-light/60">
            {lang === "en" ? "Distance" : "距離"}:
          </span>
          {distances.map((d) => {
            const target = bestEvent(selStroke, d, selCourse);
            return (
              <Link
                key={d}
                href={eventUrl(target)}
                className={d === selDist ? PILL_ACTIVE : PILL_INACTIVE}
              >
                {d}m
              </Link>
            );
          })}
        </div>
        {/* Stroke */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-16 shrink-0 text-xs font-medium text-muted dark:text-pool-light/60">
            {lang === "en" ? "Stroke" : "泳式"}:
          </span>
          {strokes.map((s) => {
            const target = bestEvent(s, selDist, selCourse);
            return (
              <Link
                key={s}
                href={eventUrl(target)}
                className={s === selStroke ? PILL_ACTIVE : PILL_INACTIVE}
              >
                {lang === "zh" ? formatStrokeZh(s) : formatStroke(s)}
              </Link>
            );
          })}
        </div>
        {/* Course */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-16 shrink-0 text-xs font-medium text-muted dark:text-pool-light/60">
            {lang === "en" ? "Course" : "賽池"}:
          </span>
          {courses.map((c) => {
            const target = bestEvent(selStroke, selDist, c);
            return (
              <Link
                key={c}
                href={eventUrl(target)}
                className={c === selCourse ? PILL_ACTIVE : PILL_INACTIVE}
              >
                {c === "LC"
                  ? lang === "en" ? "Long Course (50m)" : "長池 (50m)"
                  : lang === "en" ? "Short Course (25m)" : "短池 (25m)"}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Gender / Age Group / Season filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted dark:text-pool-light/60">
          {dict.leaderboard.filters}:
        </span>

        {/* Gender */}
        <div className="flex items-center gap-1">
          <Link href={filterUrl("gender", undefined)} className={!gender ? PILL_ACTIVE : PILL_INACTIVE}>
            {lang === "en" ? "All" : "全部"}
          </Link>
          {filterOptions.genders.map((g) => (
            <Link key={g} href={filterUrl("gender", g)} className={gender === g ? PILL_ACTIVE : PILL_INACTIVE}>
              {g === "Male" ? dict.common.male : dict.common.female}
            </Link>
          ))}
        </div>

        <span className="hidden text-pool-border dark:text-pool-border sm:inline">|</span>

        {/* Age Group */}
        <div className="flex items-center gap-1">
          <NavSelect
            id="ageGroup"
            label={lang === "en" ? "Age group" : "年齡組別"}
            value={ageGroup || ""}
            options={[
              { value: "", label: lang === "en" ? "All ages" : "所有年齡" },
              ...filterOptions.ageGroups.map((ag) => ({ value: ag, label: ag })),
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
            label={lang === "en" ? "Season" : "賽季"}
            value={season || ""}
            options={[
              { value: "", label: dict.leaderboard.allTime },
              ...filterOptions.seasons.map((s) => ({ value: s, label: s })),
            ]}
            urlMap={Object.fromEntries([
              ["", filterUrl("season", undefined)],
              ...filterOptions.seasons.map((s) => [s, filterUrl("season", s)]),
            ])}
          />
        </div>

        <span className="hidden text-pool-border dark:text-pool-border sm:inline">|</span>

        {/* Competition type */}
        <div className="flex items-center gap-1">
          <Link href={filterUrl("compType", undefined)} className={!validCompType ? PILL_ACTIVE : PILL_INACTIVE}>
            {lang === "en" ? "All" : "全部"}
          </Link>
          <Link href={filterUrl("compType", "local")} className={validCompType === "local" ? PILL_ACTIVE : PILL_INACTIVE}>
            {lang === "en" ? "Local" : "本地"}
          </Link>
          <Link href={filterUrl("compType", "masters")} className={validCompType === "masters" ? PILL_ACTIVE : PILL_INACTIVE}>
            {lang === "en" ? "Masters" : "先進"}
          </Link>
        </div>

        {hasFilters && (
          <>
            <span className="hidden text-pool-border dark:text-pool-border sm:inline">|</span>
            <Link
              href={`/${lang}/leaderboards?event=${selectedEvent}`}
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
          {selDist}m {strokeLabel}{" "}
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium ${
              selCourse === "LC"
                ? "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300"
                : "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300"
            }`}
          >
            {selCourse === "LC" ? dict.common.lc : dict.common.sc}
          </span>
          {gender && (
            <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
              {gender === "Male" ? dict.common.male : dict.common.female}
            </span>
          )}
          {ageGroup && (
            <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
              {ageGroup}
            </span>
          )}
          {season && (
            <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300">
              {season}
            </span>
          )}
          {validCompType && (
            <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
              {validCompType === "masters"
                ? lang === "en" ? "Masters" : "先進"
                : lang === "en" ? "Local" : "本地"}
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
                    {dict.common.team}
                  </th>
                  <th className="hidden px-3 py-2.5 text-center font-semibold text-pool-deep dark:text-pool-light sm:table-cell">
                    {dict.swimmer.age}
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
                    key={pb.swimmer_id}
                    className={`water-row border-b border-pool-border/50 dark:border-pool-border/50 ${
                      i % 2 === 1 ? "bg-pool-surface/50 dark:bg-surface-alt/30" : ""
                    }`}
                  >
                    <td className="px-2 py-2 text-center font-medium sm:px-3">
                      <MedalRank rank={i + 1} />
                    </td>
                    <td className="px-2 py-2 sm:px-3">
                      <Link
                        href={`/${lang}/swimmer/${encodeURIComponent(pb.swimmer_id)}`}
                        className="font-medium text-pool-mid hover:text-pool-deep dark:text-pool-light dark:hover:text-white"
                      >
                        {pb.swimmer_name}
                      </Link>
                      <div className="mt-0.5 text-xs text-muted dark:text-pool-light/50 sm:hidden">
                        <Link
                          href={`/${lang}/club/${pb.club}`}
                          className="hover:text-pool-mid dark:hover:text-pool-light"
                        >
                          {pb.club}
                        </Link>
                        {pb.age && <> · {pb.age}</>}
                      </div>
                    </td>
                    <td className="hidden px-3 py-2 text-center sm:table-cell">
                      <Link
                        href={`/${lang}/club/${pb.club}`}
                        className="font-medium text-foreground/80 hover:text-pool-mid dark:hover:text-pool-light"
                        title={getClubName(pb.club, lang === "zh" ? "zh" : "en")}
                      >
                        {pb.club}
                      </Link>
                    </td>
                    <td className="hidden px-3 py-2 text-center text-muted dark:text-pool-light/60 sm:table-cell">
                      {pb.age}
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
