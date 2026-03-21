"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Dict } from "@/lib/i18n";

interface SwimmerOption {
  id: string;
  name: string;
  club: string;
}

interface CompetitionOption {
  id: string;
  name: string;
  date: string;
  course: string;
}

interface ResultOption {
  event_num: number;
  distance: string;
  stroke: string;
  course: string;
  age_group: string;
  finals_time: string;
  place: number | null;
  time_standard: string;
}

type AppealType = "correction" | "missing_record";

const inputClass =
  "rounded-md border border-pool-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-pool-mid focus:outline-none focus:ring-1 focus:ring-pool-mid dark:border-pool-border dark:bg-pool-deep/50 dark:placeholder:text-pool-light/30";

/* ── Icons ── */

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
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
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin text-pool-mid"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function StepBadge({
  num,
  active,
  done,
}: {
  num: number;
  active: boolean;
  done: boolean;
}) {
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
        done
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
          : active
            ? "bg-pool-mid text-white"
            : "bg-pool-surface text-muted dark:bg-surface-alt dark:text-pool-light/40"
      }`}
    >
      {done ? "✓" : num}
    </span>
  );
}

export function AppealForm({
  lang,
  dict,
  action,
}: {
  lang: string;
  dict: Dict;
  action: (formData: FormData) => void;
}) {
  const d = dict.appeals;
  const [appealType, setAppealType] = useState<AppealType>("correction");
  const isCorrection = appealType === "correction";

  /* ── Swimmer search state (correction mode) ── */
  const [swimmerQuery, setSwimmerQuery] = useState("");
  const [swimmerResults, setSwimmerResults] = useState<SwimmerOption[]>([]);
  const [selectedSwimmer, setSelectedSwimmer] = useState<SwimmerOption | null>(
    null
  );
  const [showSwimmerDropdown, setShowSwimmerDropdown] = useState(false);
  const [swimmerLoading, setSwimmerLoading] = useState(false);
  const [swimmerIdx, setSwimmerIdx] = useState(0);
  const swimmerRef = useRef<HTMLDivElement>(null);
  const swimmerInputRef = useRef<HTMLInputElement>(null);

  /* ── Competition state (correction mode) ── */
  const [competitions, setCompetitions] = useState<CompetitionOption[]>([]);
  const [selectedCompetition, setSelectedCompetition] =
    useState<CompetitionOption | null>(null);
  const [compsLoading, setCompsLoading] = useState(false);

  /* ── Result state (correction mode) ── */
  const [results, setResults] = useState<ResultOption[]>([]);
  const [selectedResult, setSelectedResult] = useState<ResultOption | null>(
    null
  );
  const [resultsLoading, setResultsLoading] = useState(false);

  /* ── Manual fields (missing_record mode) ── */
  const [manualSwimmerName, setManualSwimmerName] = useState("");
  const [manualCompetition, setManualCompetition] = useState("");
  const [manualEvent, setManualEvent] = useState("");
  const [manualTime, setManualTime] = useState("");

  /* ── Reset all when switching type ── */
  function switchType(type: AppealType) {
    setAppealType(type);
    // Reset correction fields
    setSelectedSwimmer(null);
    setSwimmerQuery("");
    setSwimmerResults([]);
    setSelectedCompetition(null);
    setSelectedResult(null);
    setCompetitions([]);
    setResults([]);
    // Reset missing fields
    setManualSwimmerName("");
    setManualCompetition("");
    setManualEvent("");
    setManualTime("");
  }

  /* ── Search swimmers with debounce ── */
  useEffect(() => {
    if (!isCorrection || selectedSwimmer) return;
    if (swimmerQuery.length < 2) {
      setSwimmerResults([]);
      setShowSwimmerDropdown(false);
      setSwimmerLoading(false);
      return;
    }
    setSwimmerLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/swimmers/search?q=${encodeURIComponent(swimmerQuery)}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        setSwimmerResults(data);
        setShowSwimmerDropdown(true);
        setSwimmerIdx(0);
      } catch {
        /* aborted */
      } finally {
        setSwimmerLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [swimmerQuery, selectedSwimmer, isCorrection]);

  /* ── Load competitions when swimmer selected ── */
  useEffect(() => {
    if (!selectedSwimmer) {
      setCompetitions([]);
      setSelectedCompetition(null);
      return;
    }
    setCompsLoading(true);
    (async () => {
      const res = await fetch(
        `/api/swimmers/competitions?id=${encodeURIComponent(selectedSwimmer.id)}`
      );
      setCompetitions(await res.json());
      setCompsLoading(false);
    })();
  }, [selectedSwimmer]);

  /* ── Load results when competition selected ── */
  useEffect(() => {
    if (!selectedSwimmer || !selectedCompetition) {
      setResults([]);
      setSelectedResult(null);
      return;
    }
    setResultsLoading(true);
    (async () => {
      const res = await fetch(
        `/api/swimmers/results?swimmer_id=${encodeURIComponent(selectedSwimmer.id)}&competition_id=${encodeURIComponent(selectedCompetition.id)}`
      );
      setResults(await res.json());
      setResultsLoading(false);
    })();
  }, [selectedSwimmer, selectedCompetition]);

  /* ── Close dropdown on outside click ── */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        swimmerRef.current &&
        !swimmerRef.current.contains(e.target as Node)
      ) {
        setShowSwimmerDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  /* ── Swimmer helpers ── */
  const selectSwimmer = useCallback((s: SwimmerOption) => {
    setSelectedSwimmer(s);
    setSwimmerQuery(s.name);
    setShowSwimmerDropdown(false);
    setSelectedCompetition(null);
    setSelectedResult(null);
  }, []);

  function clearSwimmer() {
    setSelectedSwimmer(null);
    setSwimmerQuery("");
    setSwimmerResults([]);
    setSelectedCompetition(null);
    setSelectedResult(null);
    setCompetitions([]);
    setResults([]);
    swimmerInputRef.current?.focus();
  }

  function handleSwimmerKeyDown(e: React.KeyboardEvent) {
    if (!showSwimmerDropdown || swimmerResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSwimmerIdx((i) => Math.min(i + 1, swimmerResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSwimmerIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectSwimmer(swimmerResults[swimmerIdx]);
    } else if (e.key === "Escape") {
      setShowSwimmerDropdown(false);
    }
  }

  const resultLabel = (r: ResultOption) =>
    `${r.distance}m ${r.stroke} ${r.course} — ${r.finals_time}${r.place ? ` (#${r.place})` : ""}${r.time_standard && !["", "SCR", "DQ", "DNF", "NS"].includes(r.time_standard) ? ` [${r.time_standard}]` : ""}`;

  const step = isCorrection
    ? selectedResult
      ? 4
      : selectedCompetition
        ? 3
        : selectedSwimmer
          ? 2
          : 1
    : 1; // missing record mode doesn't have steps

  /* ── Compute hidden field values ── */
  const swimmerNameValue = isCorrection
    ? selectedSwimmer?.name || ""
    : manualSwimmerName;
  const swimmerIdValue = isCorrection ? selectedSwimmer?.id || "" : "";
  const competitionValue = isCorrection
    ? selectedCompetition
      ? `${selectedCompetition.name} (${selectedCompetition.date})`
      : ""
    : manualCompetition;
  const eventValue = isCorrection
    ? selectedResult
      ? `${selectedResult.distance}m ${selectedResult.stroke} ${selectedResult.course}`
      : ""
    : manualEvent;
  const timeValue = isCorrection
    ? selectedResult?.finals_time || ""
    : manualTime;

  const canSubmit = isCorrection ? !!selectedSwimmer : !!manualSwimmerName;

  return (
    <form
      action={action}
      className="grid gap-4 rounded-lg border border-pool-border bg-pool-surface/50 p-5 dark:border-pool-border dark:bg-surface-alt/50 sm:grid-cols-2"
    >
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="appeal_type" value={appealType} />
      <input type="hidden" name="swimmer_name" value={swimmerNameValue} />
      <input type="hidden" name="swimmer_id" value={swimmerIdValue} />
      <input type="hidden" name="competition_name" value={competitionValue} />
      <input type="hidden" name="event_description" value={eventValue} />
      <input type="hidden" name="recorded_time" value={timeValue} />

      {/* ── Appeal type toggle ── */}
      <div className="sm:col-span-2">
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => switchType("correction")}
            className={`rounded-lg border-2 p-3 text-left transition-colors ${
              isCorrection
                ? "border-pool-mid bg-sky-50 dark:border-pool-light dark:bg-pool-light/10"
                : "border-pool-border bg-white hover:border-pool-mid/50 dark:border-pool-border dark:bg-pool-deep/30 dark:hover:border-pool-light/30"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full border-2 text-xs ${
                  isCorrection
                    ? "border-pool-mid bg-pool-mid text-white dark:border-pool-light dark:bg-pool-light dark:text-pool-deep"
                    : "border-gray-300 dark:border-pool-border"
                }`}
              >
                {isCorrection && "✓"}
              </span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {d.typeCorrection}
              </span>
            </div>
            <p className="mt-1 pl-7 text-xs text-slate-500 dark:text-pool-light/50">
              {d.typeCorrectionDesc}
            </p>
          </button>
          <button
            type="button"
            onClick={() => switchType("missing_record")}
            className={`rounded-lg border-2 p-3 text-left transition-colors ${
              !isCorrection
                ? "border-pool-mid bg-sky-50 dark:border-pool-light dark:bg-pool-light/10"
                : "border-pool-border bg-white hover:border-pool-mid/50 dark:border-pool-border dark:bg-pool-deep/30 dark:hover:border-pool-light/30"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full border-2 text-xs ${
                  !isCorrection
                    ? "border-pool-mid bg-pool-mid text-white dark:border-pool-light dark:bg-pool-light dark:text-pool-deep"
                    : "border-gray-300 dark:border-pool-border"
                }`}
              >
                {!isCorrection && "✓"}
              </span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {d.typeMissing}
              </span>
            </div>
            <p className="mt-1 pl-7 text-xs text-slate-500 dark:text-pool-light/50">
              {d.typeMissingDesc}
            </p>
          </button>
        </div>
      </div>

      {/* ── Submitter info ── */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="submitter_name"
          className="text-sm font-medium text-foreground"
        >
          {d.nameLabel}
        </label>
        <input
          type="text"
          id="submitter_name"
          name="submitter_name"
          placeholder={d.namePlaceholder}
          maxLength={100}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="submitter_email"
          className="text-sm font-medium text-foreground"
        >
          {d.emailLabel}
        </label>
        <input
          type="email"
          id="submitter_email"
          name="submitter_email"
          placeholder={d.emailPlaceholder}
          maxLength={200}
          className={inputClass}
        />
      </div>

      {/* ════════════════════════════════════════════════
          CORRECTION MODE — cascading autocomplete
         ════════════════════════════════════════════════ */}
      {isCorrection && (
        <>
          {/* Step 1: Swimmer search */}
          <div
            className="flex flex-col gap-1.5 sm:col-span-2"
            ref={swimmerRef}
          >
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <StepBadge num={1} active={step === 1} done={step > 1} />
              {d.swimmerNameLabel} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted dark:text-pool-light/50" />
              <input
                ref={swimmerInputRef}
                type="text"
                value={swimmerQuery}
                onChange={(e) => {
                  setSwimmerQuery(e.target.value);
                  if (selectedSwimmer) clearSwimmer();
                }}
                onKeyDown={handleSwimmerKeyDown}
                onFocus={() =>
                  swimmerResults.length > 0 &&
                  !selectedSwimmer &&
                  setShowSwimmerDropdown(true)
                }
                placeholder={
                  lang === "en"
                    ? "Type to search swimmers..."
                    : "輸入以搜尋泳手..."
                }
                className={`${inputClass} w-full pl-9 pr-16`}
              />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                {swimmerLoading && <Spinner />}
                {selectedSwimmer && (
                  <button
                    type="button"
                    onClick={clearSwimmer}
                    className="rounded px-1.5 py-0.5 text-xs text-muted hover:bg-pool-surface dark:text-pool-light/50 dark:hover:bg-surface-alt"
                  >
                    ✕
                  </button>
                )}
              </div>

              {showSwimmerDropdown && swimmerResults.length > 0 && (
                <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-pool-border bg-surface py-1 shadow-lg dark:border-pool-border dark:bg-surface">
                  {swimmerResults.map((s, i) => (
                    <li
                      key={s.id}
                      className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm ${
                        i === swimmerIdx
                          ? "bg-pool-surface dark:bg-surface-alt"
                          : "hover:bg-pool-surface/50 dark:hover:bg-surface-alt/50"
                      }`}
                      onMouseEnter={() => setSwimmerIdx(i)}
                      onClick={() => selectSwimmer(s)}
                    >
                      <span className="text-base">🏊</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-foreground">
                          {s.name}
                        </div>
                        <div className="truncate text-xs text-muted dark:text-pool-light/60">
                          {s.club} · ID: {s.id}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {showSwimmerDropdown &&
                swimmerResults.length === 0 &&
                swimmerQuery.length >= 2 &&
                !swimmerLoading && (
                  <div className="absolute z-50 mt-1 w-full rounded-lg border border-pool-border bg-surface px-4 py-3 text-sm text-muted shadow-lg dark:border-pool-border dark:bg-surface dark:text-pool-light/50">
                    {lang === "en" ? "No swimmers found" : "找不到泳手"}
                  </div>
                )}
            </div>

            {selectedSwimmer && (
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                <span>✓</span>
                <span>
                  {selectedSwimmer.name} · {selectedSwimmer.club} · ID:{" "}
                  {selectedSwimmer.id}
                </span>
              </div>
            )}
          </div>

          {/* Step 2: Competition select */}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label
              htmlFor="competition_select"
              className="flex items-center gap-2 text-sm font-medium text-foreground"
            >
              <StepBadge num={2} active={step === 2} done={step > 2} />
              {d.competitionLabel}
              {compsLoading && <Spinner />}
            </label>
            <select
              id="competition_select"
              disabled={!selectedSwimmer || compsLoading}
              value={selectedCompetition?.id || ""}
              onChange={(e) => {
                const comp = competitions.find((c) => c.id === e.target.value);
                setSelectedCompetition(comp || null);
                setSelectedResult(null);
              }}
              className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <option value="">
                {!selectedSwimmer
                  ? lang === "en"
                    ? "← Select a swimmer first"
                    : "← 請先選擇泳手"
                  : compsLoading
                    ? lang === "en"
                      ? "Loading competitions..."
                      : "載入比賽中..."
                    : lang === "en"
                      ? `Select competition (${competitions.length} found)`
                      : `選擇比賽（共 ${competitions.length} 場）`}
              </option>
              {competitions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.date} ({c.course})
                </option>
              ))}
            </select>
          </div>

          {/* Step 3: Result select */}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label
              htmlFor="result_select"
              className="flex items-center gap-2 text-sm font-medium text-foreground"
            >
              <StepBadge num={3} active={step === 3} done={step > 3} />
              {d.eventLabel} / {d.recordedTimeLabel}
              {resultsLoading && <Spinner />}
            </label>
            <select
              id="result_select"
              disabled={!selectedCompetition || resultsLoading}
              value={selectedResult ? `${selectedResult.event_num}` : ""}
              onChange={(e) => {
                const r = results.find(
                  (r) => `${r.event_num}` === e.target.value
                );
                setSelectedResult(r || null);
              }}
              className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <option value="">
                {!selectedCompetition
                  ? lang === "en"
                    ? "← Select a competition first"
                    : "← 請先選擇比賽"
                  : resultsLoading
                    ? lang === "en"
                      ? "Loading results..."
                      : "載入成績中..."
                    : lang === "en"
                      ? `Select event/result (${results.length} found)`
                      : `選擇項目/成績（共 ${results.length} 項）`}
              </option>
              {results.map((r) => (
                <option key={r.event_num} value={`${r.event_num}`}>
                  {resultLabel(r)}
                </option>
              ))}
            </select>
          </div>

          {/* Selected result summary */}
          {selectedResult && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-900/20 sm:col-span-2">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                {lang === "en" ? "Appealing this result" : "申訴此成績"}
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <span>
                  <span className="font-medium text-foreground">
                    {d.eventLabel}:
                  </span>{" "}
                  <span className="text-muted dark:text-pool-light/60">
                    {selectedResult.distance}m {selectedResult.stroke}{" "}
                    {selectedResult.course}
                  </span>
                </span>
                <span>
                  <span className="font-medium text-foreground">
                    {d.recordedTimeLabel}:
                  </span>{" "}
                  <span className="font-mono text-muted dark:text-pool-light/60">
                    {selectedResult.finals_time}
                  </span>
                </span>
                {selectedResult.place != null && (
                  <span>
                    <span className="font-medium text-foreground">
                      {lang === "en" ? "Place" : "名次"}:
                    </span>{" "}
                    <span className="text-muted dark:text-pool-light/60">
                      #{selectedResult.place}
                    </span>
                  </span>
                )}
                {selectedResult.time_standard &&
                  !["", "SCR", "DQ", "DNF", "NS"].includes(
                    selectedResult.time_standard
                  ) && (
                    <span>
                      <span className="font-medium text-foreground">
                        {lang === "en" ? "Standard" : "標準"}:
                      </span>{" "}
                      <span className="text-muted dark:text-pool-light/60">
                        {selectedResult.time_standard}
                      </span>
                    </span>
                  )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════
          MISSING RECORD MODE — manual input
         ════════════════════════════════════════════════ */}
      {!isCorrection && (
        <>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label
              htmlFor="manual_swimmer"
              className="text-sm font-medium text-foreground"
            >
              {d.swimmerNameLabel} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="manual_swimmer"
              value={manualSwimmerName}
              onChange={(e) => setManualSwimmerName(e.target.value)}
              placeholder={d.missingSwimmerPlaceholder}
              maxLength={200}
              required
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="manual_competition"
              className="text-sm font-medium text-foreground"
            >
              {d.competitionLabel}
            </label>
            <input
              type="text"
              id="manual_competition"
              value={manualCompetition}
              onChange={(e) => setManualCompetition(e.target.value)}
              placeholder={d.missingCompetitionPlaceholder}
              maxLength={300}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="manual_event"
              className="text-sm font-medium text-foreground"
            >
              {d.eventLabel}
            </label>
            <input
              type="text"
              id="manual_event"
              value={manualEvent}
              onChange={(e) => setManualEvent(e.target.value)}
              placeholder={d.missingEventPlaceholder}
              maxLength={200}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label
              htmlFor="manual_time"
              className="text-sm font-medium text-foreground"
            >
              {d.recordedTimeLabel}
            </label>
            <input
              type="text"
              id="manual_time"
              value={manualTime}
              onChange={(e) => setManualTime(e.target.value)}
              placeholder={d.missingTimePlaceholder}
              maxLength={50}
              className={`${inputClass} sm:max-w-xs`}
            />
          </div>
        </>
      )}

      {/* ── Reason & requested change ── */}
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label
          htmlFor="reason"
          className="text-sm font-medium text-foreground"
        >
          {d.reasonLabel} <span className="text-red-500">*</span>
        </label>
        <textarea
          id="reason"
          name="reason"
          required
          rows={3}
          maxLength={2000}
          placeholder={
            isCorrection ? d.reasonPlaceholder : d.missingReasonPlaceholder
          }
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label
          htmlFor="requested_change"
          className="text-sm font-medium text-foreground"
        >
          {d.requestedChangeLabel} <span className="text-red-500">*</span>
        </label>
        <textarea
          id="requested_change"
          name="requested_change"
          required
          rows={2}
          maxLength={2000}
          placeholder={
            isCorrection
              ? d.requestedChangePlaceholder
              : d.missingRequestedChangePlaceholder
          }
          className={inputClass}
        />
      </div>

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md bg-pool-mid px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-pool-deep focus:outline-none focus:ring-2 focus:ring-pool-mid focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-pool-mid dark:hover:bg-pool-deep"
        >
          {d.submitButton}
        </button>
      </div>
    </form>
  );
}
