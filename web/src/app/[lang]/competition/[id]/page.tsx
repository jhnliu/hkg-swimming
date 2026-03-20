import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale, getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import {
  getCompetition,
  getCompetitionEvents,
  getCompetitionResults,
  formatStroke,
  formatStrokeZh,
  tierLabel,
} from "@/lib/db";
import type { Result, SwimEvent } from "@/lib/db";
import { Breadcrumb } from "@/components/breadcrumb";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const comp = await getCompetition(id);
  return {
    title: comp ? `${comp.name} — HKG Swimming` : "Competition — HKG Swimming",
  };
}

function EventResultsTable({
  event,
  results,
  lang,
  dict,
}: {
  event: SwimEvent;
  results: Result[];
  lang: Locale;
  dict: Awaited<ReturnType<typeof getDictionary>>;
}) {
  const genderLabel =
    event.gender === "Men" || event.gender === "Boys"
      ? dict.common.male
      : dict.common.female;
  const strokeLabel =
    lang === "zh" ? formatStrokeZh(event.stroke) : formatStroke(event.stroke);

  return (
    <div>
      <h3 className="mb-2 text-base font-semibold text-foreground">
        Event {event.event_num} · {genderLabel} {event.age_group} ·{" "}
        {event.distance}m {strokeLabel}
      </h3>
      <div className="overflow-x-auto rounded-lg border border-pool-border dark:border-pool-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-pool-border bg-pool-surface dark:border-pool-border dark:bg-surface-alt">
              <th className="w-12 px-3 py-2 text-center font-semibold text-pool-deep dark:text-pool-light">
                {dict.common.place}
              </th>
              <th className="px-3 py-2 text-left font-semibold text-pool-deep dark:text-pool-light">
                {dict.common.name}
              </th>
              <th className="px-3 py-2 text-center font-semibold text-pool-deep dark:text-pool-light">
                {dict.swimmer.age}
              </th>
              <th className="px-3 py-2 text-center font-semibold text-pool-deep dark:text-pool-light">
                {dict.common.team}
              </th>
              <th className="px-3 py-2 text-right font-semibold text-pool-deep dark:text-pool-light">
                {dict.common.seedTime}
              </th>
              <th className="px-3 py-2 text-right font-semibold text-pool-deep dark:text-pool-light">
                {dict.common.finalsTime}
              </th>
              <th className="w-16 px-3 py-2 text-center font-semibold text-pool-deep dark:text-pool-light">
                Std
              </th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr
                key={i}
                className={`water-row border-b border-pool-border/50 dark:border-pool-border/50 ${
                  i % 2 === 1 ? "bg-pool-surface/50 dark:bg-surface-alt/30" : ""
                }`}
              >
                <td className="px-3 py-2 text-center text-muted dark:text-pool-light/50">
                  {r.place ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/${lang}/swimmer/${encodeURIComponent(r.swimmer_id)}`}
                    className="font-medium text-pool-mid hover:text-pool-deep dark:text-pool-light dark:hover:text-white"
                  >
                    {r.swimmer_name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-center text-muted dark:text-pool-light/60">
                  {r.age}
                </td>
                <td className="px-3 py-2 text-center">
                  <Link
                    href={`/${lang}/club/${r.club}`}
                    className="font-medium text-foreground/80 hover:text-pool-mid dark:hover:text-pool-light"
                  >
                    {r.club}
                  </Link>
                </td>
                <td className="px-3 py-2 text-right font-mono text-muted timing-display dark:text-pool-light/60">
                  {r.seed_time || "NT"}
                </td>
                <td className="px-3 py-2 text-right font-mono font-medium text-foreground timing-display">
                  {r.finals_time || r.time_standard || "—"}
                </td>
                <td className="px-3 py-2 text-center">
                  {r.time_standard &&
                    !["SCR", "DQ", "DNF", "NS"].includes(r.time_standard) && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                        {r.time_standard}
                      </span>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function CompetitionPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang as Locale);
  const comp = await getCompetition(id);
  if (!comp) notFound();

  const events = await getCompetitionEvents(id);
  const results = await getCompetitionResults(id);

  // Group results by event_num
  const resultsByEvent = new Map<number, Result[]>();
  for (const r of results) {
    if (!resultsByEvent.has(r.event_num)) resultsByEvent.set(r.event_num, []);
    resultsByEvent.get(r.event_num)!.push(r);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Breadcrumb
          lang={lang as Locale}
          items={[
            { label: dict.nav.competitions, href: `/${lang}/competitions` },
            { label: comp.name },
          ]}
        />
        <h1 className="text-3xl font-bold text-foreground">
          {comp.name}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted dark:text-pool-light/60">
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
      </div>

      <section className="flex flex-col gap-8">
        <h2 className="lane-line text-xl font-semibold text-foreground">
          {dict.competition.results} ({results.length})
        </h2>
        {events.map((event) => (
          <EventResultsTable
            key={event.event_num}
            event={event}
            results={resultsByEvent.get(event.event_num) || []}
            lang={lang as Locale}
            dict={dict}
          />
        ))}
      </section>
    </div>
  );
}
