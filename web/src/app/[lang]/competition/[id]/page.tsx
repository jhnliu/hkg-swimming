import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import {
  getCompetition,
  getCompetitionEvents,
  formatStroke,
  formatStrokeZh,
  tierLabel,
} from "@/lib/db";
import { Breadcrumb } from "@/components/breadcrumb";
import { CompetitionResults } from "@/components/competition-results";
import { alternatesForPath, ogMeta } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { lang, id } = await params;
  const locale = (isLocale(lang) ? lang : "en") as Locale;
  const dict = await getDictionary(locale);
  const comp = await getCompetition(id);
  if (!comp) return { title: "Competition" };
  const course = comp.course === "LC" ? dict.seo.longCourse : dict.seo.shortCourse;
  const description = dict.seo.competitionDescription
    .replace("{name}", comp.name)
    .replace("{date}", comp.date)
    .replace("{course}", course);
  const path = `/competition/${id}`;
  return {
    title: comp.name,
    description,
    alternates: alternatesForPath(path),
    openGraph: ogMeta({ title: comp.name, description, path, lang: locale }),
  };
}

export default async function CompetitionPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  const [dict, comp, events] = await Promise.all([
    getDictionary(lang as Locale),
    getCompetition(id),
    getCompetitionEvents(id),
  ]);
  if (!comp) notFound();

  // Build event labels for the client component
  const eventLabels = events.map((event) => {
    const genderLabel =
      event.gender === "Men" || event.gender === "Boys"
        ? dict.common.male
        : dict.common.female;
    const strokeLabel =
      lang === "zh" ? formatStrokeZh(event.stroke) : formatStroke(event.stroke);
    return {
      event_num: event.event_num,
      label: `${genderLabel} ${event.age_group} · ${event.distance}m ${strokeLabel}`,
    };
  });

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

      <div>
        <h2 className="lane-line mb-6 text-xl font-semibold text-foreground">
          {dict.competition.results} ({events.length} {dict.competition.event.toLowerCase()}{events.length !== 1 && lang === "en" ? "s" : ""})
        </h2>
        <CompetitionResults
          competitionId={id}
          events={eventLabels}
          lang={lang as Locale}
          dict={dict}
        />
      </div>
    </div>
  );
}
