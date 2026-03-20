import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale, getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import {
  getLeaderboard,
  getLeaderboardEventKeys,
  formatStroke,
  formatStrokeZh,
} from "@/lib/db";

const DEFAULT_EVENT = "Freestyle_100_LC";

export const metadata: Metadata = {
  title: "Leaderboards — HKG Swimming",
};

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
  searchParams: Promise<{ event?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { event: eventParam } = await searchParams;

  const dict = await getDictionary(lang as Locale);
  const eventKeys = await getLeaderboardEventKeys();

  const selectedEvent =
    eventParam && eventKeys.includes(eventParam) ? eventParam : DEFAULT_EVENT;
  const [selStroke, selDist, selCourse] = selectedEvent.split("_");

  const top = await getLeaderboard(selectedEvent, 25);

  const strokeLabel =
    lang === "zh" ? formatStrokeZh(selStroke) : formatStroke(selStroke);

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

      {/* Event filters */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-pool-border bg-surface p-3 dark:border-pool-border dark:bg-surface">
        {eventKeys.map((key) => {
          const [s, d, c] = key.split("_");
          const label = `${d}m ${lang === "zh" ? formatStrokeZh(s) : formatStroke(s)} ${c}`;
          const active = key === selectedEvent;
          return (
            <Link
              key={key}
              href={`/${lang}/leaderboards?event=${key}`}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                active
                  ? "filter-active"
                  : "bg-pool-surface text-muted hover:bg-pool-border dark:bg-surface-alt dark:text-pool-light/70 dark:hover:bg-pool-border"
              }`}
            >
              {label}
            </Link>
          );
        })}
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
                  <th className="w-12 px-3 py-2.5 text-center font-semibold text-pool-deep dark:text-pool-light">
                    {dict.common.place}
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold text-pool-deep dark:text-pool-light">
                    {dict.common.name}
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold text-pool-deep dark:text-pool-light">
                    {dict.common.team}
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold text-pool-deep dark:text-pool-light">
                    {dict.swimmer.age}
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold text-pool-deep dark:text-pool-light">
                    {dict.swimmer.time}
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold text-pool-deep dark:text-pool-light">
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
                    <td className="px-3 py-2 text-center font-medium">
                      <MedalRank rank={i + 1} />
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/${lang}/swimmer/${encodeURIComponent(pb.swimmer_id)}`}
                        className="font-medium text-pool-mid hover:text-pool-deep dark:text-pool-light dark:hover:text-white"
                      >
                        {pb.swimmer_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Link
                        href={`/${lang}/club/${pb.club}`}
                        className="font-medium text-foreground/80 hover:text-pool-mid dark:hover:text-pool-light"
                      >
                        {pb.club}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-center text-muted dark:text-pool-light/60">
                      {pb.age}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-medium tracking-wider text-foreground timing-display">
                      {pb.time}
                    </td>
                    <td className="px-3 py-2 text-right text-muted dark:text-pool-light/60">
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
