import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale, getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { search } from "@/lib/db";
import { localizedMeta } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang as Locale);
  return localizedMeta({ lang: lang as Locale, dict, titleKey: dict.nav.swimmers, descriptionKey: "searchDescription", path: "/search" });
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { q } = await searchParams;

  const dict = await getDictionary(lang as Locale);
  const results = q ? await search(q, 30) : [];

  const swimmers = results.filter((r) => r.type === "swimmer");
  const clubs = results.filter((r) => r.type === "club");
  const competitions = results.filter((r) => r.type === "competition");

  const typeIcons = { swimmer: "🏊", club: "🏢", competition: "🏆" };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {lang === "en" ? "Search" : "搜尋"}
        </h1>
      </div>

      <form action={`/${lang}/search`} method="get" className="relative max-w-xl">
        <svg
          className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted dark:text-pool-light/50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          name="q"
          type="text"
          defaultValue={q || ""}
          placeholder={dict.home.searchPlaceholder}
          autoFocus
          className="h-12 w-full rounded-lg border border-pool-border bg-surface pl-11 pr-4 text-base text-foreground shadow-sm placeholder:text-muted/50 focus:border-pool-mid focus:outline-none focus:ring-2 focus:ring-pool-mid/20 dark:border-pool-border dark:bg-surface dark:placeholder:text-pool-light/40"
        />
      </form>

      {q && (
        <p className="text-sm text-muted dark:text-pool-light/60">
          {results.length} {lang === "en" ? "results for" : "個結果："}{" "}
          &ldquo;{q}&rdquo;
        </p>
      )}

      {/* Swimmers */}
      {swimmers.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
            <span>{typeIcons.swimmer}</span>
            {lang === "en" ? "Swimmers" : "泳手"}{" "}
            <span className="text-sm font-normal text-muted/60">
              ({swimmers.length})
            </span>
          </h2>
          <div className="overflow-x-auto rounded-lg border border-pool-border dark:border-pool-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pool-border bg-pool-surface dark:border-pool-border dark:bg-surface-alt">
                  <th className="px-3 py-2 text-left font-semibold text-pool-deep dark:text-pool-light">
                    {dict.common.name}
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-pool-deep dark:text-pool-light">
                    {lang === "en" ? "Details" : "詳情"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {swimmers.map((s, i) => (
                  <tr
                    key={s.id}
                    className={`water-row border-b border-pool-border/50 dark:border-pool-border/50 ${
                      i % 2 === 1 ? "bg-pool-surface/50 dark:bg-surface-alt/30" : ""
                    }`}
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/${lang}/swimmer/${encodeURIComponent(s.id)}`}
                        className="font-medium text-pool-mid hover:text-pool-deep dark:text-pool-light dark:hover:text-white"
                      >
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted dark:text-pool-light/60">
                      {s.subtitle}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Clubs */}
      {clubs.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
            <span>{typeIcons.club}</span>
            {lang === "en" ? "Clubs" : "泳會"}{" "}
            <span className="text-sm font-normal text-muted/60">
              ({clubs.length})
            </span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {clubs.map((c) => (
              <Link
                key={c.id}
                href={`/${lang}/club/${c.id}`}
                className="flex items-center gap-2 rounded-lg border border-pool-border bg-surface px-4 py-2 hover:border-pool-mid hover:shadow-md dark:border-pool-border dark:bg-surface dark:hover:border-pool-light"
              >
                <span className="font-mono text-sm font-bold text-pool-deep dark:text-pool-light">
                  {c.name}
                </span>
                <span className="text-xs text-muted dark:text-pool-light/60">
                  {c.subtitle}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Competitions */}
      {competitions.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
            <span>{typeIcons.competition}</span>
            {lang === "en" ? "Competitions" : "比賽"}{" "}
            <span className="text-sm font-normal text-muted/60">
              ({competitions.length})
            </span>
          </h2>
          <div className="flex flex-col gap-2">
            {competitions.map((c) => (
              <Link
                key={c.id}
                href={`/${lang}/competition/${c.id}`}
                className="flex flex-col gap-1 rounded-lg border border-pool-border bg-surface px-4 py-3 hover:border-pool-mid hover:shadow-md sm:flex-row sm:items-center sm:justify-between dark:border-pool-border dark:bg-surface dark:hover:border-pool-light"
              >
                <span className="font-medium text-foreground">
                  {c.name}
                </span>
                <span className="text-sm text-muted dark:text-pool-light/60">
                  {c.subtitle}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {q && results.length === 0 && (
        <p className="text-muted dark:text-pool-light/50">
          {dict.common.noResults}
        </p>
      )}
    </div>
  );
}
