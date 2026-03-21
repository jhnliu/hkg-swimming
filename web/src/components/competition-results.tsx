"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import type { SwimEvent, Result } from "@/lib/db";

interface EventLabel {
  event_num: number;
  label: string;
}

interface CompetitionResultsProps {
  competitionId: string;
  events: EventLabel[];
  lang: "en" | "zh";
  dict: {
    competition: {
      searchPlaceholder: string;
      filterByEvent: string;
      allEvents: string;
      showAll: string;
      collapseAll: string;
      noMatches: string;
      loadingResults: string;
      results: string;
    };
    common: {
      place: string;
      name: string;
      team: string;
      seedTime: string;
      finalsTime: string;
      noResults: string;
      loading: string;
      male: string;
      female: string;
    };
    swimmer: {
      age: string;
    };
  };
}

export function CompetitionResults({
  competitionId,
  events,
  lang,
  dict,
}: CompetitionResultsProps) {
  const [swimmerQuery, setSwimmerQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());
  const [eventResults, setEventResults] = useState<Map<number, Result[]>>(new Map());
  const [swimmerResults, setSwimmerResults] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState<Set<number | "swimmer">>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const isSearchMode = swimmerQuery.length >= 2;

  const fetchEventResults = useCallback(
    async (eventNum: number) => {
      if (eventResults.has(eventNum)) return;
      setLoading((prev) => new Set(prev).add(eventNum));
      try {
        const res = await fetch(
          `/api/competition/${competitionId}/results?event_num=${eventNum}`
        );
        const data: Result[] = await res.json();
        setEventResults((prev) => new Map(prev).set(eventNum, data));
      } finally {
        setLoading((prev) => {
          const next = new Set(prev);
          next.delete(eventNum);
          return next;
        });
      }
    },
    [competitionId, eventResults]
  );

  const fetchSwimmerResults = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setSwimmerResults(null);
        return;
      }
      setLoading((prev) => new Set(prev).add("swimmer"));
      try {
        const res = await fetch(
          `/api/competition/${competitionId}/results?swimmer=${encodeURIComponent(query)}`
        );
        const data: Result[] = await res.json();
        setSwimmerResults(data);
      } finally {
        setLoading((prev) => {
          const next = new Set(prev);
          next.delete("swimmer");
          return next;
        });
      }
    },
    [competitionId]
  );

  const handleSwimmerSearch = (value: string) => {
    setSwimmerQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 2) {
      setSwimmerResults(null);
      return;
    }
    debounceRef.current = setTimeout(() => fetchSwimmerResults(value), 300);
  };

  const toggleEvent = (eventNum: number) => {
    const next = new Set(expandedEvents);
    if (next.has(eventNum)) {
      next.delete(eventNum);
    } else {
      next.add(eventNum);
      fetchEventResults(eventNum);
    }
    setExpandedEvents(next);
  };

  const handleEventFilter = (value: string) => {
    if (value === "all") {
      setSelectedEvent(null);
    } else {
      const num = parseInt(value, 10);
      setSelectedEvent(num);
      if (!expandedEvents.has(num)) {
        const next = new Set(expandedEvents);
        next.add(num);
        setExpandedEvents(next);
      }
      fetchEventResults(num);
    }
  };

  const showAll = () => {
    const allNums = new Set(events.map((e) => e.event_num));
    setExpandedEvents(allNums);
    for (const e of events) {
      fetchEventResults(e.event_num);
    }
  };

  const collapseAll = () => {
    setExpandedEvents(new Set());
    setSelectedEvent(null);
  };

  // Which events to display
  const visibleEvents =
    selectedEvent !== null
      ? events.filter((e) => e.event_num === selectedEvent)
      : events;

  // Swimmer search results grouped by event_num
  const swimmerResultsByEvent = new Map<number, Result[]>();
  if (swimmerResults) {
    for (const r of swimmerResults) {
      if (!swimmerResultsByEvent.has(r.event_num))
        swimmerResultsByEvent.set(r.event_num, []);
      swimmerResultsByEvent.get(r.event_num)!.push(r);
    }
  }

  const matchedEvents = isSearchMode
    ? events.filter((e) => swimmerResultsByEvent.has(e.event_num))
    : visibleEvents;

  return (
    <section className="flex flex-col gap-6">
      {/* Filters bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {/* Swimmer search */}
        <div className="relative flex-1 max-w-sm">
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
            value={swimmerQuery}
            onChange={(e) => handleSwimmerSearch(e.target.value)}
            placeholder={dict.competition.searchPlaceholder}
            className="h-10 w-full rounded-lg border border-pool-border bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-muted/50 focus:border-pool-mid focus:outline-none focus:ring-2 focus:ring-pool-mid/20 dark:border-pool-border dark:bg-surface dark:placeholder:text-pool-light/40"
          />
          {swimmerQuery && (
            <button
              onClick={() => handleSwimmerSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground dark:text-pool-light/50 dark:hover:text-pool-light"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Event filter dropdown */}
        {!isSearchMode && (
          <select
            value={selectedEvent ?? "all"}
            onChange={(e) => handleEventFilter(e.target.value)}
            className="h-10 rounded-lg border border-pool-border bg-surface px-3 text-sm text-foreground focus:border-pool-mid focus:outline-none focus:ring-2 focus:ring-pool-mid/20 dark:border-pool-border dark:bg-surface"
          >
            <option value="all">{dict.competition.allEvents} ({events.length})</option>
            {events.map((e) => (
              <option key={e.event_num} value={e.event_num}>
                Event {e.event_num} · {e.label}
              </option>
            ))}
          </select>
        )}

        {/* Show all / Collapse all */}
        {!isSearchMode && (
          <div className="flex gap-2">
            <button
              onClick={showAll}
              className="rounded-lg border border-pool-border px-3 py-2 text-xs font-medium text-pool-mid hover:bg-pool-surface dark:border-pool-border dark:text-pool-light dark:hover:bg-surface-alt"
            >
              {dict.competition.showAll}
            </button>
            {expandedEvents.size > 0 && (
              <button
                onClick={collapseAll}
                className="rounded-lg border border-pool-border px-3 py-2 text-xs font-medium text-muted hover:bg-pool-surface dark:border-pool-border dark:text-pool-light/60 dark:hover:bg-surface-alt"
              >
                {dict.competition.collapseAll}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Swimmer search loading */}
      {isSearchMode && loading.has("swimmer") && (
        <p className="text-sm text-muted dark:text-pool-light/50">
          {dict.competition.loadingResults}
        </p>
      )}

      {/* Swimmer search results */}
      {isSearchMode && !loading.has("swimmer") && swimmerResults !== null && (
        <>
          <p className="text-sm text-muted dark:text-pool-light/60">
            {swimmerResults.length} {dict.competition.results.toLowerCase()}{" "}
            &ldquo;{swimmerQuery}&rdquo;
          </p>
          {matchedEvents.length === 0 && (
            <p className="text-muted dark:text-pool-light/50">
              {dict.competition.noMatches}
            </p>
          )}
          {matchedEvents.map((event) => (
            <div key={event.event_num}>
              <h3 className="mb-2 text-sm font-semibold text-foreground dark:text-pool-light">
                Event {event.event_num} · {event.label}
              </h3>
              <EventResultsTable
                eventLabel={event.label}
                eventNum={event.event_num}
                results={swimmerResultsByEvent.get(event.event_num) || []}
                lang={lang}
                dict={dict}
              />
            </div>
          ))}
        </>
      )}

      {/* Normal event browsing */}
      {!isSearchMode && (
        <div className="flex flex-col gap-4">
          {matchedEvents.map((event) => {
            const isExpanded = expandedEvents.has(event.event_num);
            const results = eventResults.get(event.event_num);
            const isLoading = loading.has(event.event_num);

            return (
              <div key={event.event_num}>
                <button
                  onClick={() => toggleEvent(event.event_num)}
                  className="flex w-full items-center gap-2 rounded-lg border border-pool-border bg-pool-surface px-4 py-3 text-left text-sm font-semibold text-foreground hover:border-pool-mid dark:border-pool-border dark:bg-surface-alt dark:hover:border-pool-light"
                >
                  <svg
                    className={`h-4 w-4 flex-shrink-0 text-muted transition-transform dark:text-pool-light/50 ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  <span>
                    Event {event.event_num} · {event.label}
                  </span>
                  {results && (
                    <span className="ml-auto text-xs font-normal text-muted dark:text-pool-light/50">
                      {results.length} {dict.competition.results.toLowerCase()}
                    </span>
                  )}
                </button>

                {isExpanded && (
                  <div className="mt-2">
                    {isLoading && (
                      <p className="px-4 py-3 text-sm text-muted dark:text-pool-light/50">
                        {dict.competition.loadingResults}
                      </p>
                    )}
                    {results && (
                      <EventResultsTable
                        eventLabel={event.label}
                        eventNum={event.event_num}
                        results={results}
                        lang={lang}
                        dict={dict}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function EventResultsTable({
  eventLabel,
  eventNum,
  results,
  lang,
  dict,
}: {
  eventLabel: string;
  eventNum: number;
  results: Result[];
  lang: "en" | "zh";
  dict: CompetitionResultsProps["dict"];
}) {
  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-pool-border dark:border-pool-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-pool-border bg-pool-surface dark:border-pool-border dark:bg-surface-alt">
              <th className="w-12 px-3 py-2 text-center font-semibold text-pool-deep dark:text-pool-light">
                {dict.common.place}
              </th>
              <th className="px-3 py-2 text-left font-semibold text-pool-deep dark:text-pool-light">
                {dict.common.name}
              </th>
              <th className="px-3 py-2 text-center font-semibold text-pool-deep dark:text-pool-light">
                {dict.swimmer.age}
              </th>
              <th className="px-3 py-2 text-center font-semibold text-pool-deep dark:text-pool-light">
                {dict.common.team}
              </th>
              <th className="px-3 py-2 text-right font-semibold text-pool-deep dark:text-pool-light">
                {dict.common.seedTime}
              </th>
              <th className="px-3 py-2 text-right font-semibold text-pool-deep dark:text-pool-light">
                {dict.common.finalsTime}
              </th>
              <th className="w-16 px-3 py-2 text-center font-semibold text-pool-deep dark:text-pool-light">
                Std
              </th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr
                key={i}
                className={`water-row border-b border-pool-border/50 dark:border-pool-border/50 ${
                  i % 2 === 1 ? "bg-pool-surface/50 dark:bg-surface-alt/30" : ""
                }`}
              >
                <td className="px-3 py-2 text-center text-muted dark:text-pool-light/50">
                  {r.place ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/${lang}/swimmer/${encodeURIComponent(r.swimmer_id)}`}
                    className="font-medium text-pool-mid hover:text-pool-deep dark:text-pool-light dark:hover:text-white"
                  >
                    {r.swimmer_name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-center text-muted dark:text-pool-light/60">
                  {r.age}
                </td>
                <td className="px-3 py-2 text-center">
                  <Link
                    href={`/${lang}/club/${r.club}`}
                    className="font-medium text-foreground/80 hover:text-pool-mid dark:hover:text-pool-light"
                  >
                    {r.club}
                  </Link>
                </td>
                <td className="px-3 py-2 text-right font-mono text-muted timing-display dark:text-pool-light/60">
                  {r.seed_time || "NT"}
                </td>
                <td className="px-3 py-2 text-right font-mono font-medium text-foreground timing-display">
                  {r.finals_time || r.time_standard || "—"}
                </td>
                <td className="px-3 py-2 text-center">
                  {r.time_standard &&
                    !["SCR", "DQ", "DNF", "NS"].includes(r.time_standard) && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                        {r.time_standard}
                      </span>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
