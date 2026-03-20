import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale, getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getClubs } from "@/lib/db";

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
            className="flex items-center justify-between rounded-lg border border-pool-border bg-surface px-4 py-3 hover:border-pool-mid hover:shadow-md dark:border-pool-border dark:bg-surface dark:hover:border-pool-light"
          >
            <span className="rounded bg-pool-surface px-2 py-1 font-mono text-sm font-bold text-pool-deep dark:bg-surface-alt dark:text-pool-light">
              {club.code}
            </span>
            <span className="text-sm text-muted dark:text-pool-light/60">
              {club.swimmer_count} {lang === "en" ? "swimmers" : "泳手"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
