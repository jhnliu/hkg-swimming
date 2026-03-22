"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TimePoint {
  date: string;
  time_seconds: number;
  time: string;
  event_label: string;
  competition_name: string;
}

function formatSeconds(s: number): string {
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = (s % 60).toFixed(2);
    return `${h}:${m.toString().padStart(2, "0")}:${sec.padStart(5, "0")}`;
  }
  if (s >= 60) {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(2);
    return `${m}:${sec.padStart(5, "0")}`;
  }
  return s.toFixed(2);
}

// Swimming-themed color palette
const COLORS = [
  "#0284c7", "#0d9488", "#7c3aed", "#db2777", "#ea580c",
  "#0891b2", "#4f46e5", "#16a34a", "#c026d3", "#ca8a04",
];

export function PbChart({
  data,
  selectEventLabel,
  allEventsLabel,
  timeLabel,
  dateLabel,
}: {
  data: TimePoint[];
  selectEventLabel: string;
  allEventsLabel: string;
  timeLabel: string;
  dateLabel: string;
}) {
  // Get unique events
  const events = useMemo(() => {
    const set = new Set<string>();
    for (const d of data) set.add(d.event_label);
    return [...set].sort();
  }, [data]);

  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  // Filter data
  const filtered = useMemo(() => {
    if (!selectedEvent) return data;
    return data.filter((d) => d.event_label === selectedEvent);
  }, [data, selectedEvent]);

  // For multi-event view: group by event, plot each as a separate series
  // For single event view: plot as one series showing progression
  const isSingleEvent = selectedEvent !== null;

  // Build chart data
  const chartData = useMemo(() => {
    if (isSingleEvent) {
      // Single event: show time progression with running PB line
      let bestSoFar = Infinity;
      return filtered.map((d) => {
        bestSoFar = Math.min(bestSoFar, d.time_seconds);
        return {
          date: d.date,
          time: d.time_seconds,
          pb: bestSoFar,
          label: d.time,
          comp: d.competition_name,
        };
      });
    }

    // Multi-event: just show all results as dots
    return filtered.map((d) => ({
      date: d.date,
      time: d.time_seconds,
      label: d.time,
      event: d.event_label,
      comp: d.competition_name,
    }));
  }, [filtered, isSingleEvent]);

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-pool-border bg-pool-surface text-sm text-muted dark:border-pool-border dark:bg-surface-alt dark:text-pool-light/50">
        No race data available
      </div>
    );
  }

  // For multi-event, group data by event for separate lines
  const eventSeries = useMemo(() => {
    if (isSingleEvent) return null;
    const map = new Map<string, { date: string; time: number; label: string; event: string; comp: string }[]>();
    for (const d of filtered) {
      if (!map.has(d.event_label)) map.set(d.event_label, []);
      map.get(d.event_label)!.push({
        date: d.date,
        time: d.time_seconds,
        label: d.time,
        event: d.event_label,
        comp: d.competition_name,
      });
    }
    return map;
  }, [filtered, isSingleEvent]);

  return (
    <div className="flex flex-col gap-3">
      {/* Event selector */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-muted dark:text-pool-light/60">
          {selectEventLabel}:
        </span>
        <button
          onClick={() => setSelectedEvent(null)}
          className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
            selectedEvent === null
              ? "filter-active"
              : "bg-pool-surface text-muted hover:bg-pool-border dark:bg-surface-alt dark:text-pool-light/70 dark:hover:bg-pool-border"
          }`}
        >
          {allEventsLabel}
        </button>
        {events.map((e) => (
          <button
            key={e}
            onClick={() => setSelectedEvent(e)}
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              selectedEvent === e
                ? "filter-active"
                : "bg-pool-surface text-muted hover:bg-pool-border dark:bg-surface-alt dark:text-pool-light/70 dark:hover:bg-pool-border"
            }`}
          >
            {e}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="w-full rounded-lg border border-pool-border bg-surface p-3 dark:border-pool-border dark:bg-surface">
        <ResponsiveContainer width="100%" height={264}>
          {isSingleEvent ? (
            <LineChart data={chartData as { date: string; time: number; pb: number; label: string; comp: string }[]} margin={{ left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-pool-border)" opacity={0.5} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                stroke="var(--color-muted)"
                label={{ value: dateLabel, position: "insideBottom", offset: -2, fontSize: 11, fill: "var(--color-muted)" }}
              />
              <YAxis
                tickFormatter={formatSeconds}
                tick={{ fontSize: 11 }}
                stroke="var(--color-muted)"
                reversed
                domain={["dataMin - 1", "dataMax + 1"]}
                label={{ value: timeLabel, angle: -90, position: "insideLeft", offset: 0, fontSize: 11, fill: "var(--color-muted)" }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-md border border-pool-border bg-surface px-3 py-2 text-xs shadow-lg dark:border-pool-border dark:bg-surface">
                      <div className="font-bold text-pool-mid dark:text-pool-light">
                        {selectedEvent}
                      </div>
                      <div className="mt-1 font-semibold text-foreground">
                        {d.label}
                      </div>
                      <div className="mt-0.5 text-muted dark:text-pool-light/60">
                        {d.date}
                      </div>
                      <div className="text-muted dark:text-pool-light/60">
                        {d.comp}
                      </div>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="time"
                stroke="#0284c7"
                strokeWidth={1.5}
                dot={{ r: 3, fill: "#0284c7" }}
                name="Time"
              />
              <Line
                type="stepAfter"
                dataKey="pb"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={false}
                name="PB"
              />
            </LineChart>
          ) : (
            <LineChart margin={{ left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-pool-border)" opacity={0.5} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                stroke="var(--color-muted)"
                allowDuplicatedCategory={false}
                label={{ value: dateLabel, position: "insideBottom", offset: -2, fontSize: 11, fill: "var(--color-muted)" }}
              />
              <YAxis
                tickFormatter={formatSeconds}
                tick={{ fontSize: 11 }}
                stroke="var(--color-muted)"
                reversed
                label={{ value: timeLabel, angle: -90, position: "insideLeft", offset: 0, fontSize: 11, fill: "var(--color-muted)" }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-md border border-pool-border bg-surface px-3 py-2 text-xs shadow-lg dark:border-pool-border dark:bg-surface">
                      <div className="font-bold text-pool-mid dark:text-pool-light">
                        {d.event}
                      </div>
                      <div className="mt-1 font-semibold text-foreground">
                        {d.label}
                      </div>
                      <div className="mt-0.5 text-muted dark:text-pool-light/60">
                        {d.date}
                      </div>
                      <div className="text-muted dark:text-pool-light/60">
                        {d.comp}
                      </div>
                    </div>
                  );
                }}
              />
              {[...eventSeries!.entries()].map(([event, points], i) => (
                <Line
                  key={event}
                  data={points}
                  type="monotone"
                  dataKey="time"
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={1.5}
                  dot={{ r: 2.5, fill: COLORS[i % COLORS.length] }}
                  name={event}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Legend for multi-event */}
      {!isSingleEvent && eventSeries && (
        <div className="flex flex-wrap gap-3 text-xs">
          {[...eventSeries.keys()].map((event, i) => (
            <button
              key={event}
              onClick={() => setSelectedEvent(event)}
              className="flex items-center gap-1.5 text-muted hover:text-foreground dark:text-pool-light/60 dark:hover:text-pool-light"
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              {event}
            </button>
          ))}
        </div>
      )}

      {/* Single event legend */}
      {isSingleEvent && (
        <div className="flex gap-4 text-xs text-muted dark:text-pool-light/60">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#0284c7" }} />
            {selectedEvent}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ borderTop: "2px dashed #10b981" }} />
            PB progression
          </span>
        </div>
      )}
    </div>
  );
}
