"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Dict } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { ThemeToggle } from "@/components/theme-toggle";

export function Nav({ lang, dict }: { lang: Locale; dict: Dict }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { href: `/${lang}`, label: dict.nav.home },
    { href: `/${lang}/competitions`, label: dict.nav.competitions },
    { href: `/${lang}/leaderboards`, label: dict.nav.leaderboards },
    { href: `/${lang}/clubs`, label: dict.nav.clubs },
    { href: `/${lang}/compare`, label: dict.nav.compare },
    { href: `/${lang}/trends`, label: dict.nav.trends },
  ];

  const otherLang = lang === "en" ? "zh" : "en";
  const switchPath = pathname.replace(`/${lang}`, `/${otherLang}`);

  return (
    <nav className="sticky top-0 z-40 border-b border-pool-border bg-gradient-to-r from-pool-deep via-pool-mid to-pool-deep backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link
            href={`/${lang}`}
            className="flex items-center gap-1.5 text-lg font-bold text-white"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 15c2.483 0 4.345-3 6-3s3.517 3 6 3 4.345-3 6-3" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 19c2.483 0 4.345-3 6-3s3.517 3 6 3 4.345-3 6-3" />
            </svg>
            HKG Swimming
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {links.map((link) => {
              const active =
                link.href === `/${lang}`
                  ? pathname === `/${lang}`
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    active
                      ? "bg-white/20 text-white"
                      : "text-sky-100 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Link
            href={switchPath}
            className="rounded-md border border-white/30 px-3 py-1 text-sm font-medium text-sky-100 hover:bg-white/10 hover:text-white"
          >
            {lang === "en" ? "中文" : "English"}
          </Link>
          {/* Mobile menu button */}
          <button
            className="rounded-md p-1.5 text-sky-100 hover:bg-white/10 md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>
      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-white/20 px-4 py-2 md:hidden">
          {links.map((link) => {
            const active =
              link.href === `/${lang}`
                ? pathname === `/${lang}`
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`block rounded-md px-3 py-2 text-sm font-medium ${
                  active
                    ? "bg-white/20 text-white"
                    : "text-sky-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
