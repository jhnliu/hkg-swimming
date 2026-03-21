"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";

interface SearchResult {
  type: "swimmer" | "club" | "competition";
  id: string;
  name: string;
  subtitle: string;
}

const typeIcons: Record<string, string> = {
  swimmer: "\u{1F3CA}",
  club: "\u{1F3E2}",
  competition: "\u{1F3C6}",
};

export function HomeSearch({
  lang,
  placeholder,
}: {
  lang: Locale;
  placeholder: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchResults = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}`,
        { signal: controller.signal }
      );
      if (!res.ok) return;
      const data: SearchResult[] = await res.json();
      setResults(data);
      setOpen(data.length > 0);
      setSelected(0);
    } catch {
      // aborted or network error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchResults(query), 200);
    return () => clearTimeout(timer);
  }, [query, fetchResults]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function navigate(item: SearchResult) {
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
    if (e.key === "Enter" && (!open || results.length === 0)) {
      // Fall through to form submit for full search
      return;
    }
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

  return (
    <div ref={ref} className="relative w-full max-w-xl">
      <form action={`/${lang}/search`} method="get" className="relative">
        <svg
          className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-sky-300"
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
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="h-12 w-full rounded-lg border border-white/20 bg-white/15 pl-11 pr-4 text-base text-white shadow-lg backdrop-blur-sm placeholder:text-sky-200/70 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
        />
      </form>
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
                  {item.name}
                </div>
                <div className="truncate text-xs text-muted dark:text-pool-light/60">
                  {item.subtitle}
                </div>
              </div>
              <span className="text-xs text-muted/60 dark:text-pool-light/40">
                {item.type}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
