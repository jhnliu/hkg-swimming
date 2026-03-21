"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import type { HkssfResult } from "@/lib/db";

interface EventLabel {
  gender: string;
  age_group: string;
  distance: string;
  stroke: string;
  has_heats: boolean;
  label: string;
}

/** Unique string key for an event */
function eventKey(e: { gender: string; age_group: string; distance: string; stroke: string }) {
  return `${e.gender}|${e.age_group}|${e.distance}|${e.stroke}`;
}

interface MergedRow {
  swimmer_name: string;
  club: string;
  heat_time: string | null;
  heat_seconds: number | null;
  final_time: string | null;
  final_seconds: number | null;
  best_seconds: number | null;
  points: number | null;
  time_standard: string;
  place: number | null;
  round: "heat" | "final" | "";
}

interface MergeResult {
  rows: MergedRow[];
  hasHeats: boolean;
}

function mergeHeatFinal(results: HkssfResult[], hasHeats: boolean): MergeResult {
  // Check if swimmers appear multiple times even when hasHeats is false
  // (newer format PDFs don't mark heat/final but still have both)
  const hasDuplicates = !hasHeats && (() => {
    const seen = new Set<string>();
    for (const r of results) {
      const key = r.swimmer_name + "|" + r.club;
      if (seen.has(key)) return true;
      seen.add(key);
    }
    return false;
  })();

  if (!hasHeats && !hasDuplicates) {
    // Truly single-round data — return as-is
    return {
      rows: results.map((r) => ({
        swimmer_name: r.swimmer_name,
        club: r.club,
        heat_time: null,
        heat_seconds: null,
        final_time: r.finals_time || null,
        final_seconds: r.time_seconds,
        best_seconds: r.time_seconds,
        points: r.points,
        time_standard: r.time_standard,
        place: r.place,
        round: (r.heat?.startsWith("Heat") ? "heat" : r.heat?.startsWith("Final") ? "final" : "") as MergedRow["round"],
      })),
      hasHeats: false,
    };
  }

  // Merge heat and final times per swimmer
  const map = new Map<string, MergedRow>();

  if (hasDuplicates) {
    // Infer heat/final from unlabeled duplicate rows.
    // Pattern: finalists appear twice (heat + final with higher points),
    // heat-only swimmers appear once with points=1.
    const groups = new Map<string, HkssfResult[]>();
    for (const r of results) {
      const key = r.swimmer_name + "|" + r.club;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }

    for (const [key, entries] of groups) {
      const row: MergedRow = {
        swimmer_name: entries[0].swimmer_name,
        club: entries[0].club,
        heat_time: null,
        heat_seconds: null,
        final_time: null,
        final_seconds: null,
        best_seconds: null,
        points: null,
        time_standard: "",
        place: null,
        round: "",
      };

      if (entries.length === 1) {
        // Single entry — heat-only swimmer (didn't make finals)
        row.heat_time = entries[0].finals_time || null;
        row.heat_seconds = entries[0].time_seconds;
        row.points = entries[0].points;
      } else {
        // Multiple entries — higher points = final, lower = heat
        const sorted = [...entries].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
        const finalEntry = sorted[0];
        const heatEntry = sorted[1];

        row.final_time = finalEntry.finals_time || null;
        row.final_seconds = finalEntry.time_seconds;
        row.points = finalEntry.points;
        row.heat_time = heatEntry.finals_time || null;
        row.heat_seconds = heatEntry.time_seconds;
      }

      if (entries.some((e) => e.time_standard)) {
        row.time_standard = entries.find((e) => e.time_standard)!.time_standard;
      }

      map.set(key, row);
    }
  } else {
    // Labeled heat/final — use heat field
    for (const r of results) {
      const key = r.swimmer_name + "|" + r.club;
      let row = map.get(key);
      if (!row) {
        row = {
          swimmer_name: r.swimmer_name,
          club: r.club,
          heat_time: null,
          heat_seconds: null,
          final_time: null,
          final_seconds: null,
          best_seconds: null,
          points: null,
          time_standard: "",
          place: null,
          round: "",
        };
        map.set(key, row);
      }
      const isHeat = r.heat?.startsWith("Heat");
      const isFinal = r.heat?.startsWith("Final");
      if (isHeat) {
        if (row.heat_seconds === null || (r.time_seconds !== null && r.time_seconds < row.heat_seconds)) {
          row.heat_time = r.finals_time || null;
          row.heat_seconds = r.time_seconds;
        }
      } else if (isFinal) {
        if (row.final_seconds === null || (r.time_seconds !== null && r.time_seconds < row.final_seconds)) {
          row.final_time = r.finals_time || null;
          row.final_seconds = r.time_seconds;
        }
      }
      if (isFinal && r.points != null) row.points = r.points;
      else if (isHeat && row.points === null && r.points != null) row.points = r.points;
      if (r.time_standard) row.time_standard = r.time_standard;
    }
  }

  // Calculate best_seconds and re-rank
  const rows = Array.from(map.values()).map((row) => {
    row.best_seconds = row.final_seconds ?? row.heat_seconds;
    row.round = row.final_seconds !== null ? "final" : row.heat_seconds !== null ? "heat" : "";
    return row;
  });

  // Sort: final swimmers first (by final time), then heat-only (by heat time), then no-time
  rows.sort((a, b) => {
    if (a.final_seconds !== null && b.final_seconds !== null)
      return a.final_seconds - b.final_seconds;
    if (a.final_seconds !== null) return -1;
    if (b.final_seconds !== null) return 1;
    if (a.heat_seconds !== null && b.heat_seconds !== null)
      return a.heat_seconds - b.heat_seconds;
    if (a.heat_seconds !== null) return -1;
    if (b.heat_seconds !== null) return 1;
    return 0;
  });

  // Assign place
  rows.forEach((row, i) => {
    row.place = row.best_seconds !== null ? i + 1 : null;
  });

  return { rows, hasHeats: true };
}

interface HkssfCompetitionResultsProps {
  competitionId: string;
  events: EventLabel[];
  lang: "en" | "zh";
  /** Pre-formatted stroke labels keyed by raw stroke value */
  strokeLabels: Record<string, string>;
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
    interSchool: {
      points: string;
      school: string;
      gradeA: string;
      gradeB: string;
      gradeC: string;
    };
    common: {
      place: string;
      name: string;
      finalsTime: string;
      heatTime: string;
      male: string;
      female: string;
      noResults: string;
      loading: string;
    };
  };
}

export function HkssfCompetitionResults({
  competitionId,
  events,
  lang,
  strokeLabels,
  dict,
}: HkssfCompetitionResultsProps) {
  const [swimmerQuery, setSwimmerQuery] = useState("");
  const [filterGender, setFilterGender] = useState<string | null>(null);
  const [filterGrade, setFilterGrade] = useState<string | null>(null);
  const [filterDistance, setFilterDistance] = useState<string | null>(null);
  const [filterStroke, setFilterStroke] = useState<string | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [eventResults, setEventResults] = useState<Map<string, HkssfResult[]>>(new Map());
  const [swimmerResults, setSwimmerResults] = useState<HkssfResult[] | null>(null);
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const isSearchMode = swimmerQuery.length >= 2;

  // Derive unique filter options from events
  const genders = [...new Set(events.map((e) => e.gender))].sort();
  const grades = [...new Set(events.map((e) => e.age_group))].sort();
  const distances = [...new Set(events.map((e) => e.distance))].sort(
    (a, b) => parseInt(a) - parseInt(b)
  );
  const strokes = [...new Set(events.map((e) => e.stroke))];

  const fetchEventResults = useCallback(
    async (event: EventLabel) => {
      const key = eventKey(event);
      if (eventResults.has(key)) return;
      setLoading((prev) => new Set(prev).add(key));
      try {
        const params = new URLSearchParams({
          gender: event.gender,
          age_group: event.age_group,
          distance: event.distance,
          stroke: event.stroke,
        });
        const res = await fetch(
          `/api/inter-school/competition/${competitionId}/results?${params}`
        );
        const data: HkssfResult[] = await res.json();
        setEventResults((prev) => new Map(prev).set(key, data));
      } finally {
        setLoading((prev) => {
          const next = new Set(prev);
          next.delete(key);
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
          `/api/inter-school/competition/${competitionId}/results?swimmer=${encodeURIComponent(query)}`
        );
        const data: HkssfResult[] = await res.json();
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

  const toggleEvent = (event: EventLabel) => {
    const key = eventKey(event);
    const next = new Set(expandedEvents);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
      fetchEventResults(event);
    }
    setExpandedEvents(next);
  };

  const showAll = () => {
    const allKeys = new Set(filteredEvents.map(eventKey));
    setExpandedEvents(allKeys);
    for (const e of filteredEvents) {
      fetchEventResults(e);
    }
  };

  const collapseAll = () => {
    setExpandedEvents(new Set());
  };

  const hasFilters = filterGender !== null || filterGrade !== null || filterDistance !== null || filterStroke !== null;
  const clearFilters = () => {
    setFilterGender(null);
    setFilterGrade(null);
    setFilterDistance(null);
    setFilterStroke(null);
  };

  const filteredEvents = events.filter((e) => {
    if (filterGender && e.gender !== filterGender) return false;
    if (filterGrade && e.age_group !== filterGrade) return false;
    if (filterDistance && e.distance !== filterDistance) return false;
    if (filterStroke && e.stroke !== filterStroke) return false;
    return true;
  });

  // Group swimmer search results by event key
  const swimmerResultsByEvent = new Map<string, HkssfResult[]>();
  if (swimmerResults) {
    for (const r of swimmerResults) {
      const key = eventKey(r);
      if (!swimmerResultsByEvent.has(key)) swimmerResultsByEvent.set(key, []);
      swimmerResultsByEvent.get(key)!.push(r);
    }
  }

  const matchedEvents = isSearchMode
    ? events.filter((e) => swimmerResultsByEvent.has(eventKey(e)))
    : filteredEvents;

  const PILL = "rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer";
  const PILL_ACTIVE = `${PILL} filter-active`;
  const PILL_INACTIVE = `${PILL} bg-pool-surface text-muted hover:bg-pool-border dark:bg-surface-alt dark:text-pool-light/70 dark:hover:bg-pool-border`;

  const gradeLabel = (g: string) =>
    g === "A" ? dict.interSchool.gradeA : g === "B" ? dict.interSchool.gradeB : dict.interSchool.gradeC;

  return (
    <section className="flex flex-col gap-6">
      {/* Search */}
      <div className="relative max-w-sm">
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

      {/* Pill filters */}
      {!isSearchMode && (
        <div className="flex flex-col gap-2 rounded-lg border border-pool-border bg-surface p-3 dark:border-pool-border dark:bg-surface">
          {/* Gender */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-16 shrink-0 text-xs font-medium text-muted dark:text-pool-light/60">
              {lang === "en" ? "Gender" : "性別"}:
            </span>
            <button
              onClick={() => setFilterGender(null)}
              className={filterGender === null ? PILL_ACTIVE : PILL_INACTIVE}
            >
              {lang === "en" ? "All" : "全部"}
            </button>
            {genders.map((g) => (
              <button
                key={g}
                onClick={() => setFilterGender(filterGender === g ? null : g)}
                className={filterGender === g ? PILL_ACTIVE : PILL_INACTIVE}
              >
                {g === "M" ? dict.common.male : dict.common.female}
              </button>
            ))}
          </div>

          {/* Grade */}
          {grades.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-16 shrink-0 text-xs font-medium text-muted dark:text-pool-light/60">
                {lang === "en" ? "Grade" : "級別"}:
              </span>
              <button
                onClick={() => setFilterGrade(null)}
                className={filterGrade === null ? PILL_ACTIVE : PILL_INACTIVE}
              >
                {lang === "en" ? "All" : "全部"}
              </button>
              {grades.map((g) => (
                <button
                  key={g}
                  onClick={() => setFilterGrade(filterGrade === g ? null : g)}
                  className={filterGrade === g ? PILL_ACTIVE : PILL_INACTIVE}
                >
                  {gradeLabel(g)}
                </button>
              ))}
            </div>
          )}

          {/* Distance */}
          {distances.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-16 shrink-0 text-xs font-medium text-muted dark:text-pool-light/60">
                {lang === "en" ? "Distance" : "距離"}:
              </span>
              <button
                onClick={() => setFilterDistance(null)}
                className={filterDistance === null ? PILL_ACTIVE : PILL_INACTIVE}
              >
                {lang === "en" ? "All" : "全部"}
              </button>
              {distances.map((d) => (
                <button
                  key={d}
                  onClick={() => setFilterDistance(filterDistance === d ? null : d)}
                  className={filterDistance === d ? PILL_ACTIVE : PILL_INACTIVE}
                >
                  {d}
                </button>
              ))}
            </div>
          )}

          {/* Stroke */}
          {strokes.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-16 shrink-0 text-xs font-medium text-muted dark:text-pool-light/60">
                {lang === "en" ? "Stroke" : "泳式"}:
              </span>
              <button
                onClick={() => setFilterStroke(null)}
                className={filterStroke === null ? PILL_ACTIVE : PILL_INACTIVE}
              >
                {lang === "en" ? "All" : "全部"}
              </button>
              {strokes.map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStroke(filterStroke === s ? null : s)}
                  className={filterStroke === s ? PILL_ACTIVE : PILL_INACTIVE}
                >
                  {strokeLabels?.[s] || s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {!isSearchMode && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted dark:text-pool-light/50">
            {filteredEvents.length} {lang === "en" ? "events" : "項目"}
          </span>
          <button
            onClick={showAll}
            className="rounded-lg border border-pool-border px-3 py-1.5 text-xs font-medium text-pool-mid hover:bg-pool-surface dark:border-pool-border dark:text-pool-light dark:hover:bg-surface-alt"
          >
            {dict.competition.showAll}
          </button>
          {expandedEvents.size > 0 && (
            <button
              onClick={collapseAll}
              className="rounded-lg border border-pool-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-pool-surface dark:border-pool-border dark:text-pool-light/60 dark:hover:bg-surface-alt"
            >
              {dict.competition.collapseAll}
            </button>
          )}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              {lang === "en" ? "Clear filters" : "清除篩選"}
            </button>
          )}
        </div>
      )}

      {/* Swimmer search loading */}
      {isSearchMode && loading.has("swimmer") && (
        <div className="flex items-center gap-2 text-sm text-muted dark:text-pool-light/50">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-pool-mid/30 border-t-pool-mid dark:border-pool-light/30 dark:border-t-pool-light" />
          {dict.competition.loadingResults}
        </div>
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
          {matchedEvents.map((event) => {
            const key = eventKey(event);
            const results = swimmerResultsByEvent.get(key) || [];
            const labeledHeats = event.has_heats && results.some((r) => r.heat?.startsWith("Heat"));
            const merged = mergeHeatFinal(results, labeledHeats);
            return (
              <div key={`search-${key}`}>
                <h3 className="mb-2 text-sm font-semibold text-foreground dark:text-pool-light">
                  {event.label}
                </h3>
                <HkssfEventResultsTable
                  rows={merged.rows}
                  hasHeats={merged.hasHeats}
                  lang={lang}
                  dict={dict}
                />
              </div>
            );
          })}
        </>
      )}

      {/* Normal event browsing */}
      {!isSearchMode && (
        <div className="flex flex-col gap-4">
          {matchedEvents.map((event) => {
            const key = eventKey(event);
            const isExpanded = expandedEvents.has(key);
            const rawResults = eventResults.get(key);
            const isLoading = loading.has(key);
            const labeledHeats = event.has_heats && (rawResults?.some((r) => r.heat?.startsWith("Heat")) ?? false);
            const merged = rawResults ? mergeHeatFinal(rawResults, labeledHeats) : null;

            return (
              <div key={`event-${key}`}>
                <button
                  onClick={() => toggleEvent(event)}
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
                  <span>{event.label}</span>
                  {rawResults && (
                    <span className="ml-auto text-xs font-normal text-muted dark:text-pool-light/50">
                      {rawResults.length} {dict.competition.results.toLowerCase()}
                    </span>
                  )}
                </button>

                {isExpanded && (
                  <div className="mt-2">
                    {isLoading && (
                      <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted dark:text-pool-light/50">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-pool-mid/30 border-t-pool-mid dark:border-pool-light/30 dark:border-t-pool-light" />
                        {dict.competition.loadingResults}
                      </div>
                    )}
                    {merged && (
                      <HkssfEventResultsTable
                        rows={merged.rows}
                        hasHeats={merged.hasHeats}
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

function HkssfEventResultsTable({
  rows,
  hasHeats,
  lang,
  dict,
}: {
  rows: MergedRow[];
  hasHeats: boolean;
  lang: "en" | "zh";
  dict: HkssfCompetitionResultsProps["dict"];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-pool-border dark:border-pool-border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-pool-border bg-pool-surface dark:border-pool-border dark:bg-surface-alt">
            <th className="w-10 px-2 py-2 text-center font-semibold text-pool-deep dark:text-pool-light sm:w-12 sm:px-3">
              {dict.common.place}
            </th>
            <th className="px-2 py-2 text-left font-semibold text-pool-deep dark:text-pool-light sm:px-3">
              {dict.common.name}
            </th>
            <th className="hidden px-3 py-2 text-center font-semibold text-pool-deep dark:text-pool-light sm:table-cell">
              {dict.interSchool.school}
            </th>
            {hasHeats && (
              <th className="px-2 py-2 text-right font-semibold text-pool-deep dark:text-pool-light sm:px-3">
                {dict.common.heatTime}
              </th>
            )}
            <th className="px-2 py-2 text-right font-semibold text-pool-deep dark:text-pool-light sm:px-3">
              {dict.common.finalsTime}
            </th>
            <th className="hidden px-3 py-2 text-center font-semibold text-pool-deep dark:text-pool-light sm:table-cell">
              {dict.interSchool.points}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              className={`water-row border-b border-pool-border/50 dark:border-pool-border/50 ${
                i % 2 === 1 ? "bg-pool-surface/50 dark:bg-surface-alt/30" : ""
              }`}
            >
              <td className="px-2 py-2 text-center text-muted dark:text-pool-light/50 sm:px-3">
                {r.place ?? "—"}
              </td>
              <td className="px-2 py-2 sm:px-3">
                <span className="font-medium text-foreground dark:text-pool-light">
                  {r.swimmer_name}
                </span>
                <div className="mt-0.5 text-xs text-muted dark:text-pool-light/50 sm:hidden">
                  <Link
                    href={`/${lang}/inter-school/school/${encodeURIComponent(r.club)}`}
                    className="hover:text-pool-mid dark:hover:text-pool-light"
                  >
                    {r.club}
                  </Link>
                </div>
              </td>
              <td className="hidden px-3 py-2 text-center sm:table-cell">
                <Link
                  href={`/${lang}/inter-school/school/${encodeURIComponent(r.club)}`}
                  className="font-medium text-foreground/80 hover:text-pool-mid dark:hover:text-pool-light"
                >
                  {r.club}
                </Link>
              </td>
              {hasHeats && (
                <td className="px-2 py-2 text-right font-mono font-medium text-foreground/70 timing-display sm:px-3">
                  {r.heat_time || "—"}
                </td>
              )}
              <td className="px-2 py-2 text-right font-mono font-medium text-foreground timing-display sm:px-3">
                {r.final_time || r.time_standard || "—"}
              </td>
              <td className="hidden px-3 py-2 text-center text-muted dark:text-pool-light/60 sm:table-cell">
                {r.points ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
