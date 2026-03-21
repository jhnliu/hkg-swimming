import Link from "next/link";
import type { Locale } from "@/lib/i18n";

interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumb({ items, lang }: { items: Crumb[]; lang: Locale }) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted dark:text-pool-light/60 sm:text-sm">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span>/</span>}
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-pool-mid dark:hover:text-pool-light"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
