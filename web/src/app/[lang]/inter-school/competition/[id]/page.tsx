import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import {
  getHkssfCompetition,
  getHkssfCompetitionEvents,
  formatHkssfStroke,
  formatHkssfStrokeZh,
  divisionLabel,
  type HkssfEvent,
} from "@/lib/db";
import { Breadcrumb } from "@/components/breadcrumb";
import { HkssfCompetitionResults } from "@/components/hkssf-competition-results";
import { alternatesForPath, ogMeta } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { lang, id } = await params;
  const locale = (isLocale(lang) ? lang : "en") as Locale;
  const dict = await getDictionary(locale);
  const comp = await getHkssfCompetition(id);
  if (!comp) return { title: "Competition" };
  const path = `/inter-school/competition/${id}`;
  return {
    title: comp.name,
    description: `${comp.name} — ${comp.date}. HKSSF inter-school swimming results.`,
    alternates: alternatesForPath(path),
    openGraph: ogMeta({
      title: comp.name,
      description: `${comp.name} — ${comp.date}. HKSSF inter-school swimming results.`,
      path,
      lang: locale,
    }),
  };
}

export default async function HkssfCompetitionPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  const [dict, comp, events] = await Promise.all([
    getDictionary(lang as Locale),
    getHkssfCompetition(id),
    getHkssfCompetitionEvents(id),
  ]);
  if (!comp) notFound();

  const formatStroke = lang === "zh" ? formatHkssfStrokeZh : formatHkssfStroke;

  const eventLabels = events.map((event) => {
    const genderLabel =
      event.gender === "M" ? dict.common.male : dict.common.female;
    const strokeLabel = formatStroke(event.stroke);
    const gradeLabel = event.age_group
      ? lang === "zh"
        ? `${event.age_group === "A" ? "甲" : event.age_group === "B" ? "乙" : "丙"}組`
        : `Grade ${event.age_group}`
      : "";
    return {
      gender: event.gender,
      age_group: event.age_group,
      distance: event.distance,
      stroke: event.stroke,
      has_heats: event.has_heats,
      label: `${genderLabel} ${gradeLabel} · ${event.distance} ${strokeLabel}`,
    };
  });

  // Build stroke label map for filter pills
  const strokeLabels: Record<string, string> = {};
  for (const e of events) {
    if (!strokeLabels[e.stroke]) {
      strokeLabels[e.stroke] = formatStroke(e.stroke);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Breadcrumb
          lang={lang as Locale}
          items={[
            { label: dict.interSchool.title, href: `/${lang}/inter-school` },
            { label: comp.name },
          ]}
        />
        <h1 className="text-3xl font-bold text-foreground">
          {comp.name}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted dark:text-pool-light/60">
          <span>{comp.date}</span>
          <span>·</span>
          <span className="rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-900/50 dark:text-sky-300">
            LC
          </span>
          <span>·</span>
          <span>{divisionLabel(comp.division, comp.region, lang as "en" | "zh")}</span>
        </div>
      </div>

      <div>
        <h2 className="lane-line mb-6 text-xl font-semibold text-foreground">
          {dict.competition.results} ({events.length} {dict.competition.event.toLowerCase()}{events.length !== 1 && lang === "en" ? "s" : ""})
        </h2>
        <HkssfCompetitionResults
          competitionId={id}
          events={eventLabels}
          strokeLabels={strokeLabels}
          lang={lang as Locale}
          dict={dict}
        />
      </div>
    </div>
  );
}
