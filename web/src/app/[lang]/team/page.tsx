import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isLocale, getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { TeamContent } from "@/components/team-content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "en") as Locale;
  const dict = await getDictionary(locale);
  return {
    title: dict.team.title,
    description: dict.team.subtitle,
  };
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang as Locale);

  return (
    <Suspense fallback={
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-foreground">{dict.team.title}</h1>
        <p className="text-sm text-muted dark:text-pool-light/60">{dict.common.loading}</p>
      </div>
    }>
      <TeamContent lang={lang as Locale} dict={dict} />
    </Suspense>
  );
}
