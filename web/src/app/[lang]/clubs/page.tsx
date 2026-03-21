import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale, getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getClubs } from "@/lib/db";
import { localizedMeta } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang as Locale);
  return localizedMeta({ lang: lang as Locale, dict, titleKey: dict.nav.clubs, descriptionKey: "clubsDescription", path: "/clubs" });
}

export default async function ClubsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang as Locale);
  const clubs = await getClubs();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold text-foreground">
        {dict.nav.clubs}
      </h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {clubs.map((club) => (
          <Link
            key={club.code}
            href={`/${lang}/club/${club.code}`}
            className="flex items-center gap-3 rounded-lg border border-pool-border bg-surface px-4 py-3 hover:border-pool-mid hover:shadow-md dark:border-pool-border dark:bg-surface dark:hover:border-pool-light"
          >
            <span className="shrink-0 rounded bg-pool-surface px-2 py-1 font-mono text-sm font-bold text-pool-deep dark:bg-surface-alt dark:text-pool-light">
              {club.code}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground/80">
              {lang === "zh" && club.name_zh !== club.code ? club.name_zh : club.name_en !== club.code ? club.name_en : ""}
            </span>
            <span className="shrink-0 text-sm text-muted dark:text-pool-light/60">
              {club.swimmer_count}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
