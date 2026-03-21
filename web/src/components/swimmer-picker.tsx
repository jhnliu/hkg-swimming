"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface SwimmerResult {
  id: string;
  name: string;
  club: string;
}

export function SwimmerPicker({
  lang,
  paramName,
  otherParam,
  otherValue,
  placeholder,
  autoFocus,
}: {
  lang: string;
  paramName: "s1" | "s2";
  otherParam?: "s1" | "s2";
  otherValue?: string;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SwimmerResult[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchResults = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(
          `/api/swimmers/search?q=${encodeURIComponent(q)}`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        const data: SwimmerResult[] = await res.json();
        setResults(data);
        setOpen(data.length > 0);
        setSelected(0);
      } catch {
        // aborted or network error
      } finally {
        setLoading(false);
      }
    }, 200);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selectSwimmer(swimmer: SwimmerResult) {
    setOpen(false);
    setQuery("");
    const params = new URLSearchParams();
    params.set(paramName, swimmer.id);
    if (otherParam && otherValue) {
      params.set(otherParam, otherValue);
    }
    router.push(`/${lang}/compare?${params.toString()}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) {
      if (e.key === "Escape") setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectSwimmer(results[selected]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted dark:text-pool-light/50"
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
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            fetchResults(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="h-10 w-full rounded-md border border-pool-border bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-muted/50 focus:border-pool-mid focus:outline-none focus:ring-2 focus:ring-pool-mid/20 dark:border-pool-border dark:bg-surface-alt dark:placeholder:text-pool-light/40 dark:focus:border-pool-light dark:focus:ring-pool-light/20"
        />
        {loading && (
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-pool-mid/30 border-t-pool-mid dark:border-pool-light/30 dark:border-t-pool-light" />
          </div>
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border border-pool-border bg-surface py-1 shadow-lg dark:border-pool-border dark:bg-surface">
          {results.map((s, i) => (
            <li
              key={s.id}
              className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${
                i === selected
                  ? "bg-pool-surface dark:bg-surface-alt"
                  : "hover:bg-pool-surface/50 dark:hover:bg-surface-alt/50"
              }`}
              onMouseEnter={() => setSelected(i)}
              onClick={() => selectSwimmer(s)}
            >
              <span className="truncate font-medium text-foreground">
                {s.name}
              </span>
              <span className="ml-2 shrink-0 text-xs text-muted dark:text-pool-light/60">
                {s.club}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
