import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale, getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import {
  getSwimmer,
  getHeadToHead,
  searchSwimmers,
  formatStroke,
  formatStrokeZh,
} from "@/lib/db";

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ s1?: string; s2?: string; q1?: string; q2?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { s1, s2, q1, q2 } = await searchParams;

  const dict = await getDictionary(lang as Locale);

  // Search results for swimmer pickers
  const search1 = q1 ? await searchSwimmers(q1, 8) : [];
  const search2 = q2 ? await searchSwimmers(q2, 8) : [];

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
            <form action={baseUrl} method="get">
              {s2 && <input type="hidden" name="s2" value={s2} />}
              <input
                name="q1"
                type="text"
                defaultValue={q1 || ""}
                placeholder={lang === "en" ? "Search swimmer..." : "搜尋泳手..."}
                className="h-10 w-full rounded-md border border-pool-border bg-surface px-3 text-sm text-foreground placeholder:text-muted/50 focus:border-pool-mid focus:outline-none dark:border-pool-border dark:bg-surface-alt dark:placeholder:text-pool-light/40"
                autoFocus
              />
              {search1.length > 0 && (
                <ul className="mt-2 rounded-md border border-pool-border bg-surface dark:border-pool-border dark:bg-surface-alt">
                  {search1.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`${baseUrl}?s1=${encodeURIComponent(s.id)}${s2 ? `&s2=${encodeURIComponent(s2)}` : ""}`}
                        className="flex items-center justify-between px-3 py-2 text-sm hover:bg-pool-surface dark:hover:bg-pool-border/30"
                      >
                        <span className="font-medium text-foreground">
                          {s.name}
                        </span>
                        <span className="text-xs text-muted dark:text-pool-light/60">
                          {s.club}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </form>
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
            <form action={baseUrl} method="get">
              {s1 && <input type="hidden" name="s1" value={s1} />}
              <input
                name="q2"
                type="text"
                defaultValue={q2 || ""}
                placeholder={lang === "en" ? "Search swimmer..." : "搜尋泳手..."}
                className="h-10 w-full rounded-md border border-pool-border bg-surface px-3 text-sm text-foreground placeholder:text-muted/50 focus:border-pool-mid focus:outline-none dark:border-pool-border dark:bg-surface-alt dark:placeholder:text-pool-light/40"
              />
              {search2.length > 0 && (
                <ul className="mt-2 rounded-md border border-pool-border bg-surface dark:border-pool-border dark:bg-surface-alt">
                  {search2.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`${baseUrl}?${s1 ? `s1=${encodeURIComponent(s1)}&` : ""}s2=${encodeURIComponent(s.id)}`}
                        className="flex items-center justify-between px-3 py-2 text-sm hover:bg-pool-surface dark:hover:bg-pool-border/30"
                      >
                        <span className="font-medium text-foreground">
                          {s.name}
                        </span>
                        <span className="text-xs text-muted dark:text-pool-light/60">
                          {s.club}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </form>
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
