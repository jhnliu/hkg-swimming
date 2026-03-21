import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale, getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getCompetitions, tierLabel } from "@/lib/db";
import { localizedMeta } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang as Locale);
  return localizedMeta({ lang: lang as Locale, dict, titleKey: dict.nav.competitions, descriptionKey: "competitionsDescription", path: "/competitions" });
}

export default async function CompetitionsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang as Locale);
  const competitions = await getCompetitions();

  // Group by season (July–June)
  const groups = new Map<string, typeof competitions>();
  for (const comp of competitions) {
    const year = parseInt(comp.date.slice(0, 4));
    const month = parseInt(comp.date.slice(5, 7));
    const season = month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
    if (!groups.has(season)) groups.set(season, []);
    groups.get(season)!.push(comp);
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold text-foreground">
        {dict.nav.competitions}
      </h1>
      {[...groups.entries()].map(([season, comps]) => (
        <section key={season}>
          <h2 className="lane-line mb-3 text-lg font-semibold text-foreground">
            {season}
          </h2>
          <div className="flex flex-col gap-2">
            {comps.map((comp) => (
              <Link
                key={comp.id}
                href={`/${lang}/competition/${comp.id}`}
                className="flex flex-col gap-2 rounded-lg border border-pool-border bg-surface px-4 py-3 hover:border-pool-mid hover:shadow-md sm:flex-row sm:items-center sm:justify-between dark:border-pool-border dark:bg-surface dark:hover:border-pool-light"
              >
                <span className="font-medium text-foreground">
                  {comp.name}
                </span>
                <div className="flex items-center gap-2 text-sm text-muted dark:text-pool-light/60">
                  <span>{comp.date}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      comp.course === "LC"
                        ? "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300"
                        : "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300"
                    }`}
                  >
                    {comp.course === "LC" ? dict.common.lc : dict.common.sc}
                  </span>
                  <span className="rounded bg-pool-surface px-1.5 py-0.5 text-xs font-medium text-muted dark:bg-surface-alt dark:text-pool-light/70">
                    {tierLabel(comp.tier, lang as Locale)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
