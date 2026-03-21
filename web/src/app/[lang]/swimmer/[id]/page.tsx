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
  getClubName,
} from "@/lib/db";
import type { PersonalBest } from "@/lib/db";
import { Breadcrumb } from "@/components/breadcrumb";
import { PbChart } from "@/components/pb-chart";
import { AddToTeamButton } from "@/components/add-to-team-button";
import { alternatesForPath, ogMeta } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { lang, id } = await params;
  const locale = (isLocale(lang) ? lang : "en") as Locale;
  const dict = await getDictionary(locale);
  const swimmer = await getSwimmer(decodeURIComponent(id));
  if (!swimmer) return { title: "Swimmer" };
  const gender = swimmer.gender === "Men" || swimmer.gender === "Boys" ? dict.common.male : dict.common.female;
  const description = dict.seo.swimmerDescription
    .replace("{name}", swimmer.name)
    .replace("{club}", swimmer.club)
    .replace("{gender}", gender);
  const path = `/swimmer/${id}`;
  return {
    title: swimmer.name,
    description,
    alternates: alternatesForPath(path),
    openGraph: ogMeta({ title: swimmer.name, description, path, lang: locale }),
  };
}

function PbTable({
  pbs,
  lang,
  label,
  dict,
}: {
  pbs: PersonalBest[];
  lang: Locale;
  label: string;
  dict: { event: string; time: string; age: string; date: string; place: string; competition: string };
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
              <th className="px-2 py-2 text-left font-semibold text-pool-deep dark:text-pool-light sm:px-3">
                {dict.event}
              </th>
              <th className="px-2 py-2 text-right font-semibold text-pool-deep dark:text-pool-light sm:px-3">
                {dict.time}
              </th>
              <th className="hidden px-3 py-2 text-center font-semibold text-pool-deep dark:text-pool-light sm:table-cell">
                {dict.place}
              </th>
              <th className="hidden px-3 py-2 text-right font-semibold text-pool-deep dark:text-pool-light sm:table-cell">
                {dict.age}
              </th>
              <th className="hidden px-3 py-2 text-right font-semibold text-pool-deep dark:text-pool-light sm:table-cell">
                {dict.competition}
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
                <td className="px-2 py-2 font-medium text-foreground sm:px-3">
                  {pb.distance}m{" "}
                  {lang === "zh"
                    ? formatStrokeZh(pb.stroke)
                    : formatStroke(pb.stroke)}
                </td>
                <td className="px-2 py-2 text-right font-mono text-foreground timing-display sm:px-3">
                  {pb.time}
                  <div className="mt-0.5 text-xs font-sans font-normal text-muted dark:text-pool-light/50 sm:hidden">
                    {pb.date}
                  </div>
                </td>
                <td className="hidden px-3 py-2 text-center text-muted dark:text-pool-light/60 sm:table-cell">
                  {pb.place != null ? pb.place : "–"}
                </td>
                <td className="hidden px-3 py-2 text-right text-muted dark:text-pool-light/60 sm:table-cell">
                  {pb.age}
                </td>
                <td className="hidden px-3 py-2 text-right sm:table-cell">
                  {pb.competition_id ? (
                    <Link
                      href={`/${lang}/competition/${encodeURIComponent(pb.competition_id)}`}
                      className="text-xs text-muted hover:text-pool-mid dark:text-pool-light/60 dark:hover:text-pool-light"
                      title={pb.competition_name || ""}
                    >
                      {pb.date}
                    </Link>
                  ) : (
                    <span className="text-xs text-muted dark:text-pool-light/60">{pb.date}</span>
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

  const [pbsLC, pbsSC, stats, timeHistory] = await Promise.all([
    getSwimmerPersonalBests(decodedId, "LC"),
    getSwimmerPersonalBests(decodedId, "SC"),
    getSwimmerStats(decodedId),
    getSwimmerTimeHistory(decodedId),
  ]);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Breadcrumb
          lang={lang as Locale}
          items={[
            { label: dict.nav.clubs, href: `/${lang}/clubs` },
            { label: getClubName(swimmer.club, lang === "zh" ? "zh" : "en"), href: `/${lang}/club/${swimmer.club}` },
            { label: swimmer.name },
          ]}
        />
        {/* Swimmer card */}
        <div className="depth-card rounded-lg border border-pool-border bg-surface p-5 dark:border-pool-border dark:bg-surface">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
              {swimmer.name}
            </h1>
            <AddToTeamButton
              swimmerId={decodedId}
              dict={{
                addToTeam: dict.team.addToTeam,
                removeFromTeam: dict.team.removeFromTeam,
                addedToTeam: dict.team.addedToTeam,
              }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted dark:text-pool-light/60">
            <Link
              href={`/${lang}/club/${swimmer.club}`}
              className="rounded bg-pool-surface px-2 py-0.5 font-medium text-pool-deep dark:bg-surface-alt dark:text-pool-light"
              title={getClubName(swimmer.club, lang === "zh" ? "zh" : "en")}
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
                title={getClubName(ch.club, lang === "zh" ? "zh" : "en")}
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
            dict={{
              event: dict.swimmer.event,
              time: dict.swimmer.time,
              age: dict.swimmer.age,
              date: dict.swimmer.date,
              place: dict.common.place,
              competition: lang === "en" ? "Competition" : "比賽",
            }}
          />
          <PbTable
            pbs={pbsLC}
            lang={lang as Locale}
            label={dict.swimmer.longCourse}
            dict={{
              event: dict.swimmer.event,
              time: dict.swimmer.time,
              age: dict.swimmer.age,
              date: dict.swimmer.date,
              place: dict.common.place,
              competition: lang === "en" ? "Competition" : "比賽",
            }}
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
