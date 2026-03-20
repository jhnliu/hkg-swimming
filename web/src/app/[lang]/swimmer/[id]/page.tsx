import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale, getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import {
  getSwimmer,
  getSwimmerPersonalBests,
  getSwimmerStats,
  getSwimmerTimeHistory,
  formatStroke,
  formatStrokeZh,
} from "@/lib/db";
import type { PersonalBest } from "@/lib/db";
import { Breadcrumb } from "@/components/breadcrumb";
import { PbChart } from "@/components/pb-chart";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const swimmer = await getSwimmer(decodeURIComponent(id));
  return {
    title: swimmer
      ? `${swimmer.name} — HKG Swimming`
      : "Swimmer — HKG Swimming",
  };
}

function PbTable({
  pbs,
  lang,
  label,
}: {
  pbs: PersonalBest[];
  lang: Locale;
  label: string;
}) {
  if (pbs.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-muted dark:text-pool-light/60">
        {label}
      </h3>
      <div className="overflow-x-auto rounded-lg border border-pool-border dark:border-pool-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-pool-border bg-pool-surface dark:border-pool-border dark:bg-surface-alt">
              <th className="px-3 py-2 text-left font-semibold text-pool-deep dark:text-pool-light">
                Event
              </th>
              <th className="px-3 py-2 text-right font-semibold text-pool-deep dark:text-pool-light">
                Time
              </th>
              <th className="px-3 py-2 text-right font-semibold text-pool-deep dark:text-pool-light">
                Age
              </th>
              <th className="px-3 py-2 text-right font-semibold text-pool-deep dark:text-pool-light">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {pbs.map((pb, i) => (
              <tr
                key={`${pb.distance}_${pb.stroke}_${pb.course}`}
                className={`water-row border-b border-pool-border/50 dark:border-pool-border/50 ${
                  i % 2 === 1 ? "bg-pool-surface/50 dark:bg-surface-alt/30" : ""
                }`}
              >
                <td className="px-3 py-2 font-medium text-foreground">
                  {pb.distance}m{" "}
                  {lang === "zh"
                    ? formatStrokeZh(pb.stroke)
                    : formatStroke(pb.stroke)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-foreground timing-display">
                  {pb.time}
                </td>
                <td className="px-3 py-2 text-right text-muted dark:text-pool-light/60">
                  {pb.age}
                </td>
                <td className="px-3 py-2 text-right text-muted dark:text-pool-light/60">
                  {pb.date}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function SwimmerPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang as Locale);
  const decodedId = decodeURIComponent(id);

  const swimmer = await getSwimmer(decodedId);
  if (!swimmer) notFound();

  const pbsLC = await getSwimmerPersonalBests(decodedId, "LC");
  const pbsSC = await getSwimmerPersonalBests(decodedId, "SC");
  const stats = await getSwimmerStats(decodedId);
  const timeHistory = await getSwimmerTimeHistory(decodedId);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Breadcrumb
          lang={lang as Locale}
          items={[
            { label: dict.nav.clubs, href: `/${lang}/clubs` },
            { label: swimmer.club, href: `/${lang}/club/${swimmer.club}` },
            { label: swimmer.name },
          ]}
        />
        {/* Swimmer card */}
        <div className="depth-card rounded-lg border border-pool-border bg-surface p-5 dark:border-pool-border dark:bg-surface">
          <h1 className="text-3xl font-bold text-foreground">
            {swimmer.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted dark:text-pool-light/60">
            <Link
              href={`/${lang}/club/${swimmer.club}`}
              className="rounded bg-pool-surface px-2 py-0.5 font-medium text-pool-deep dark:bg-surface-alt dark:text-pool-light"
            >
              {swimmer.club}
            </Link>
            <span>
              {swimmer.gender === "Men" || swimmer.gender === "Boys"
                ? dict.common.male
                : dict.common.female}
            </span>
            <span>·</span>
            <span>
              {dict.swimmer.competitions}: {stats.competition_count}
            </span>
            <span>·</span>
            <span>
              {dict.swimmer.results}: {stats.result_count}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-muted/70 dark:text-pool-light/40">
            <span>
              {dict.swimmer.firstCompeted}: {stats.first_competed}
            </span>
            <span>
              {dict.swimmer.lastCompeted}: {stats.last_competed}
            </span>
          </div>
        </div>
      </div>

      {/* Club history */}
      {swimmer.club_history.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-muted dark:text-pool-light/60">
            {dict.swimmer.club}:
          </span>
          {swimmer.club_history.map((ch, i) => (
            <span key={i} className="text-foreground/80">
              <Link
                href={`/${lang}/club/${ch.club}`}
                className="font-medium text-pool-mid hover:text-pool-deep dark:text-pool-light dark:hover:text-white"
              >
                {ch.club}
              </Link>
              <span className="ml-1 text-xs text-muted/60 dark:text-pool-light/40">
                ({ch.first_seen.slice(0, 4)}–{ch.last_seen.slice(0, 4)})
              </span>
              {i < swimmer.club_history.length - 1 && " → "}
            </span>
          ))}
        </div>
      )}

      {/* Personal Bests */}
      <section>
        <h2 className="lane-line mb-4 text-xl font-semibold text-foreground">
          {dict.swimmer.personalBests}
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <PbTable
            pbs={pbsSC}
            lang={lang as Locale}
            label={dict.swimmer.shortCourse}
          />
          <PbTable
            pbs={pbsLC}
            lang={lang as Locale}
            label={dict.swimmer.longCourse}
          />
        </div>
      </section>

      {/* Time progression chart */}
      <section>
        <h2 className="lane-line mb-4 text-xl font-semibold text-foreground">
          {dict.swimmer.raceHistory}
        </h2>
        <PbChart
          data={timeHistory}
          selectEventLabel={lang === "en" ? "Event" : "項目"}
          allEventsLabel={lang === "en" ? "All events" : "所有項目"}
          timeLabel={dict.swimmer.time}
          dateLabel={dict.swimmer.date}
        />
      </section>
    </div>
  );
}
