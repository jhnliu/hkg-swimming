"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Fuse from "fuse.js";
import type { Locale } from "@/lib/i18n";

interface SearchItem {
  type: "swimmer" | "club" | "competition";
  id: string;
  label: string;
  sublabel: string;
}

export function SearchBar({
  lang,
  placeholder,
  searchIndex,
}: {
  lang: Locale;
  placeholder: string;
  searchIndex: {
    swimmers: { id: string; name: string; club: string; gender: string }[];
    clubs: { code: string; name: string }[];
    competitions: { id: string; name: string; date: string; course: string }[];
  };
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const items: SearchItem[] = [
    ...searchIndex.swimmers.map((s) => ({
      type: "swimmer" as const,
      id: s.id,
      label: s.name,
      sublabel: s.club,
    })),
    ...searchIndex.clubs.map((c) => ({
      type: "club" as const,
      id: c.code,
      label: c.name,
      sublabel: c.code,
    })),
    ...searchIndex.competitions.map((c) => ({
      type: "competition" as const,
      id: c.id,
      label: c.name,
      sublabel: `${c.date} · ${c.course}`,
    })),
  ];

  const fuse = useRef(
    new Fuse(items, {
      keys: ["label", "sublabel", "id"],
      threshold: 0.3,
    })
  );

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const hits = fuse.current.search(query, { limit: 8 });
    setResults(hits.map((h) => h.item));
    setOpen(true);
    setSelected(0);
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function navigate(item: SearchItem) {
    setOpen(false);
    setQuery("");
    switch (item.type) {
      case "swimmer":
        router.push(`/${lang}/swimmer/${encodeURIComponent(item.id)}`);
        break;
      case "club":
        router.push(`/${lang}/club/${encodeURIComponent(item.id)}`);
        break;
      case "competition":
        router.push(`/${lang}/competition/${encodeURIComponent(item.id)}`);
        break;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      navigate(results[selected]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const typeIcons: Record<string, string> = {
    swimmer: "🏊",
    club: "🏢",
    competition: "🏆",
  };

  return (
    <div ref={ref} className="relative w-full max-w-xl">
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted dark:text-pool-light/50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="h-12 w-full rounded-lg border border-pool-border bg-surface pl-11 pr-4 text-base text-foreground shadow-sm placeholder:text-muted/50 focus:border-pool-mid focus:outline-none focus:ring-2 focus:ring-pool-mid/20 dark:border-pool-border dark:bg-surface dark:placeholder:text-pool-light/40 dark:focus:border-pool-light dark:focus:ring-pool-light/20"
        />
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-lg border border-pool-border bg-surface py-1 shadow-lg dark:border-pool-border dark:bg-surface">
          {results.map((item, i) => (
            <li
              key={`${item.type}-${item.id}`}
              className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm ${
                i === selected
                  ? "bg-pool-surface dark:bg-surface-alt"
                  : "hover:bg-pool-surface/50 dark:hover:bg-surface-alt/50"
              }`}
              onMouseEnter={() => setSelected(i)}
              onClick={() => navigate(item)}
            >
              <span className="text-base">{typeIcons[item.type]}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-foreground">
                  {item.label}
                </div>
                <div className="truncate text-xs text-muted dark:text-pool-light/60">
                  {item.sublabel}
                </div>
              </div>
              <span className="text-xs text-muted/60 dark:text-pool-light/40">{item.type}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
