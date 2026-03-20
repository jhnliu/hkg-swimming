import { notFound } from "next/navigation";
import { isLocale, getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { Nav } from "@/components/nav";

export function generateStaticParams() {
  return [{ lang: "en" }, { lang: "zh" }];
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang as Locale);

  return (
    <>
      <Nav lang={lang as Locale} dict={dict} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {children}
      </main>
      <footer className="border-t border-pool-border py-6 dark:border-pool-border">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs text-muted/60 dark:text-pool-light/40">
          <p>HKG Swimming Data Platform</p>
          <p className="mt-1">
            Data sourced from{" "}
            <span className="font-medium">hkgswimming.org.hk</span>
            {" · "}
            {lang === "en" ? "Not affiliated with HKASA" : "與香港業餘游泳總會無關"}
          </p>
        </div>
      </footer>
    </>
  );
}
