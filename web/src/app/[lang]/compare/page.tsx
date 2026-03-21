import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale, getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { localizedMeta } from "@/lib/seo";
import {
  getSwimmer,
  getHeadToHead,
  formatStroke,
  formatStrokeZh,
} from "@/lib/db";
import { SwimmerPicker } from "@/components/swimmer-picker";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang as Locale);
  return localizedMeta({ lang: lang as Locale, dict, titleKey: dict.nav.compare, descriptionKey: "compareDescription", path: "/compare" });
}

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ s1?: string; s2?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { s1, s2 } = await searchParams;

  const dict = await getDictionary(lang as Locale);

  // Load selected swimmers
  const swimmer1 = s1 ? await getSwimmer(s1) : undefined;
  const swimmer2 = s2 ? await getSwimmer(s2) : undefined;

  // Head to head comparison
  const comparison =
    swimmer1 && swimmer2 ? await getHeadToHead(swimmer1.id, swimmer2.id) : [];

  // Count wins
  let wins1 = 0;
  let wins2 = 0;
  for (const c of comparison) {
    if (c.swimmer1_seconds < c.swimmer2_seconds) wins1++;
    else if (c.swimmer2_seconds < c.swimmer1_seconds) wins2++;
  }

  const baseUrl = `/${lang}/compare`;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {dict.nav.compare}
        </h1>
        <p className="mt-1 text-sm text-muted dark:text-pool-light/60">
          {lang === "en"
            ? "Compare personal bests across shared events"
            : "比較兩位泳手在相同項目的個人最佳成績"}
        </p>
      </div>

      {/* Swimmer pickers — styled as "lanes" */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Swimmer 1 */}
        <div className="depth-card rounded-lg border border-pool-border bg-surface p-4 dark:border-pool-border dark:bg-surface">
          <h3 className="mb-2 text-sm font-semibold text-muted dark:text-pool-light/60">
            {lang === "en" ? "Swimmer 1" : "泳手 1"}
          </h3>
          {swimmer1 ? (
            <div className="flex items-center justify-between">
              <div>
                <Link
                  href={`/${lang}/swimmer/${encodeURIComponent(swimmer1.id)}`}
                  className="text-lg font-bold text-pool-mid hover:text-pool-deep dark:text-pool-light dark:hover:text-white"
                >
                  {swimmer1.name}
                </Link>
                <span className="ml-2 text-sm text-muted dark:text-pool-light/60">
                  {swimmer1.club}
                </span>
              </div>
              <Link
                href={`${baseUrl}?${s2 ? `s2=${encodeURIComponent(s2)}` : ""}`}
                className="text-xs text-muted/60 hover:text-pool-mid dark:text-pool-light/40"
              >
                {lang === "en" ? "Change" : "更改"}
              </Link>
            </div>
          ) : (
            <SwimmerPicker
              lang={lang}
              paramName="s1"
              otherParam={s2 ? "s2" : undefined}
              otherValue={s2}
              placeholder={lang === "en" ? "Search swimmer..." : "搜尋泳手..."}
              autoFocus
            />
          )}
        </div>

        {/* Swimmer 2 */}
        <div className="depth-card rounded-lg border border-pool-border bg-surface p-4 dark:border-pool-border dark:bg-surface">
          <h3 className="mb-2 text-sm font-semibold text-muted dark:text-pool-light/60">
            {lang === "en" ? "Swimmer 2" : "泳手 2"}
          </h3>
          {swimmer2 ? (
            <div className="flex items-center justify-between">
              <div>
                <Link
                  href={`/${lang}/swimmer/${encodeURIComponent(swimmer2.id)}`}
                  className="text-lg font-bold text-pool-mid hover:text-pool-deep dark:text-pool-light dark:hover:text-white"
                >
                  {swimmer2.name}
                </Link>
                <span className="ml-2 text-sm text-muted dark:text-pool-light/60">
                  {swimmer2.club}
                </span>
              </div>
              <Link
                href={`${baseUrl}?${s1 ? `s1=${encodeURIComponent(s1)}` : ""}`}
                className="text-xs text-muted/60 hover:text-pool-mid dark:text-pool-light/40"
              >
                {lang === "en" ? "Change" : "更改"}
              </Link>
            </div>
          ) : (
            <SwimmerPicker
              lang={lang}
              paramName="s2"
              otherParam={s1 ? "s1" : undefined}
              otherValue={s1}
              placeholder={lang === "en" ? "Search swimmer..." : "搜尋泳手..."}
            />
          )}
        </div>
      </div>

      {/* Comparison table */}
      {swimmer1 && swimmer2 && (
        <section>
          {/* Score */}
          <div className="mb-4 flex items-center justify-center gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-foreground">
                {wins1}
              </div>
              <div className="text-xs text-muted dark:text-pool-light/60">
                {swimmer1.name.split(",")[0]}
              </div>
            </div>
            <div className="text-lg text-muted/40 dark:text-pool-light/30">vs</div>
            <div>
              <div className="text-2xl font-bold text-foreground">
                {wins2}
              </div>
              <div className="text-xs text-muted dark:text-pool-light/60">
                {swimmer2.name.split(",")[0]}
              </div>
            </div>
          </div>

          {comparison.length === 0 ? (
            <p className="text-center text-muted dark:text-pool-light/50">
              {lang === "en"
                ? "No shared events found"
                : "沒有相同的比賽項目"}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-pool-border dark:border-pool-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pool-border bg-pool-surface dark:border-pool-border dark:bg-surface-alt">
                    <th className="px-3 py-2.5 text-left font-semibold text-pool-deep dark:text-pool-light">
                      {lang === "en" ? "Event" : "項目"}
                    </th>
                    <th className="px-3 py-2.5 text-right font-semibold text-pool-deep dark:text-pool-light">
                      {swimmer1.name.split(",")[0]}
                    </th>
                    <th className="w-16 px-3 py-2.5 text-center font-semibold text-pool-deep dark:text-pool-light">
                      +/-
                    </th>
                    <th className="px-3 py-2.5 text-right font-semibold text-pool-deep dark:text-pool-light">
                      {swimmer2.name.split(",")[0]}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((c) => {
                    const diff = c.swimmer1_seconds - c.swimmer2_seconds;
                    const diffStr =
                      Math.abs(diff) < 0.01
                        ? "="
                        : `${diff > 0 ? "+" : ""}${diff.toFixed(2)}s`;
                    return (
                      <tr
                        key={`${c.distance}_${c.stroke}_${c.course}`}
                        className="water-row border-b border-pool-border/50 dark:border-pool-border/50"
                      >
                        <td className="px-3 py-2 font-medium text-foreground">
                          {c.distance}m{" "}
                          {lang === "zh"
                            ? formatStrokeZh(c.stroke)
                            : formatStroke(c.stroke)}{" "}
                          <span className="text-xs text-muted/60">{c.course}</span>
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-mono timing-display ${
                            diff < 0
                              ? "font-bold text-emerald-600 dark:text-emerald-400"
                              : "text-foreground"
                          }`}
                        >
                          {c.swimmer1_time}
                        </td>
                        <td className="px-3 py-2 text-center text-xs text-muted dark:text-pool-light/50">
                          {diffStr}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-mono timing-display ${
                            diff > 0
                              ? "font-bold text-emerald-600 dark:text-emerald-400"
                              : "text-foreground"
                          }`}
                        >
                          {c.swimmer2_time}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
