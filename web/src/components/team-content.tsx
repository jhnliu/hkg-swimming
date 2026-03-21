"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTeam } from "@/components/team-provider";
import type { Locale, Dict } from "@/lib/i18n";
import type { SwimmerSummary } from "@/lib/db";

const CODE_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export function TeamContent({ lang, dict }: { lang: Locale; dict: Dict }) {
  const {
    swimmerIds,
    teamCode,
    teamName,
    removeSwimmer,
    clearTeam,
    loadFromServer,
    setTeamCode,
    setTeamName,
    hydrated,
  } = useTeam();

  const searchParams = useSearchParams();
  const [swimmers, setSwimmers] = useState<SwimmerSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [showSaveLoad, setShowSaveLoad] = useState(false);
  const [autoLoaded, setAutoLoaded] = useState(false);

  // Fetch swimmer data when IDs change
  const fetchSwimmers = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      setSwimmers([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/team/swimmers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ swimmer_ids: ids }),
      });
      const data = await res.json();
      // Preserve the order from swimmerIds
      const byId = new Map(data.map((s: SwimmerSummary) => [s.id, s]));
      setSwimmers(ids.map((id) => byId.get(id)).filter(Boolean) as SwimmerSummary[]);
    } catch {
      setSwimmers([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (hydrated) fetchSwimmers(swimmerIds);
  }, [hydrated, swimmerIds, fetchSwimmers]);

  // Sync inputs from context
  useEffect(() => {
    if (hydrated) {
      setCodeInput(teamCode || "");
      setNameInput(teamName || "");
    }
  }, [hydrated, teamCode, teamName]);

  // Auto-load from URL param ?code=xxx
  useEffect(() => {
    if (!hydrated || autoLoaded) return;
    const urlCode = searchParams.get("code");
    if (urlCode && urlCode !== teamCode) {
      setAutoLoaded(true);
      loadTeamByCode(urlCode);
    } else {
      setAutoLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, autoLoaded]);

  async function loadTeamByCode(code: string) {
    try {
      const res = await fetch(`/api/team/${encodeURIComponent(code)}`);
      if (!res.ok) {
        setMessage({ text: dict.team.notFound, type: "err" });
        return;
      }
      const data = await res.json();
      const ids = Array.isArray(data.swimmer_ids) ? data.swimmer_ids : [];
      loadFromServer(ids, code, data.name || null);
      setCodeInput(code);
      setNameInput(data.name || "");
      setMessage({ text: dict.team.loaded, type: "ok" });
    } catch {
      setMessage({ text: dict.team.notFound, type: "err" });
    }
  }

  async function handleSave() {
    const code = codeInput.trim().toLowerCase();
    if (!CODE_RE.test(code)) {
      setMessage({ text: dict.team.invalidCode, type: "err" });
      return;
    }
    try {
      const res = await fetch(`/api/team/${encodeURIComponent(code)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          swimmer_ids: swimmerIds,
          name: nameInput.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setMessage({
          text: data.error === "invalid_code" ? dict.team.invalidCode : "Error saving",
          type: "err",
        });
        return;
      }
      setTeamCode(code);
      setTeamName(nameInput.trim() || null);
      setMessage({ text: dict.team.saved, type: "ok" });
    } catch {
      setMessage({ text: "Error saving", type: "err" });
    }
  }

  async function handleLoad() {
    const code = codeInput.trim().toLowerCase();
    if (!CODE_RE.test(code)) {
      setMessage({ text: dict.team.invalidCode, type: "err" });
      return;
    }
    await loadTeamByCode(code);
  }

  // Clear message after a few seconds
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [message]);

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-foreground">{dict.team.title}</h1>
        <p className="text-sm text-muted dark:text-pool-light/60">{dict.common.loading}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{dict.team.title}</h1>
        <p className="mt-1 text-sm text-muted dark:text-pool-light/60">
          {dict.team.subtitle}
        </p>
      </div>

      {/* Save/Load panel */}
      <div className="depth-card rounded-lg border border-pool-border bg-surface p-4 dark:border-pool-border dark:bg-surface">
        <button
          onClick={() => setShowSaveLoad(!showSaveLoad)}
          className="flex w-full items-center justify-between text-sm font-medium text-foreground"
        >
          <span>
            {teamCode
              ? `${dict.team.teamCode}: ${teamCode}${teamName ? ` (${teamName})` : ""}`
              : `${dict.team.saveTeam} / ${dict.team.loadTeam}`}
          </span>
          <svg
            className={`h-4 w-4 text-muted transition-transform dark:text-pool-light/60 ${showSaveLoad ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showSaveLoad && (
          <div className="mt-4 flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted dark:text-pool-light/60">
                {dict.team.teamCode}
              </label>
              <input
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder={dict.team.teamCodePlaceholder}
                maxLength={30}
                className="w-full rounded-md border border-pool-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted/50 dark:border-pool-border dark:bg-surface-alt dark:placeholder:text-pool-light/30"
              />
              <p className="mt-1 text-[11px] text-muted/60 dark:text-pool-light/40">
                {dict.team.teamCodeHint}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted dark:text-pool-light/60">
                {dict.team.teamName}
              </label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder={dict.team.teamNamePlaceholder}
                maxLength={100}
                className="w-full rounded-md border border-pool-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted/50 dark:border-pool-border dark:bg-surface-alt dark:placeholder:text-pool-light/30"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleSave}
                disabled={swimmerIds.length === 0}
                className="rounded-md bg-pool-mid px-4 py-2 text-sm font-medium text-white hover:bg-pool-deep disabled:opacity-40"
              >
                {dict.team.saveTeam}
              </button>
              <button
                onClick={handleLoad}
                className="rounded-md border border-pool-border px-4 py-2 text-sm font-medium text-foreground hover:bg-pool-surface dark:border-pool-border dark:hover:bg-surface-alt"
              >
                {dict.team.loadTeam}
              </button>
              {swimmerIds.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm(dict.team.clearConfirm)) clearTeam();
                  }}
                  className="rounded-md px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  {dict.team.clearTeam}
                </button>
              )}
            </div>

            {teamCode && (
              <p className="text-xs text-muted/60 dark:text-pool-light/40">
                {dict.team.shareLink}:{" "}
                <code className="rounded bg-pool-surface px-1.5 py-0.5 text-[11px] dark:bg-surface-alt">
                  /{lang}/team?code={teamCode}
                </code>
                {" · "}
                {dict.team.codeTaken}
              </p>
            )}

            {message && (
              <p
                className={`text-sm font-medium ${
                  message.type === "ok"
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {message.text}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Swimmer count */}
      {swimmerIds.length > 0 && (
        <p className="text-sm text-muted dark:text-pool-light/60">
          {swimmerIds.length} {dict.team.swimmers}
        </p>
      )}

      {/* Swimmer grid */}
      {loading ? (
        <p className="text-sm text-muted dark:text-pool-light/60">{dict.common.loading}</p>
      ) : swimmers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-pool-border p-8 text-center dark:border-pool-border">
          <p className="text-sm text-muted dark:text-pool-light/60">{dict.team.emptyTeam}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {swimmers.map((s) => (
            <SwimmerCard
              key={s.id}
              swimmer={s}
              lang={lang}
              dict={dict}
              onRemove={() => removeSwimmer(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SwimmerCard({
  swimmer,
  lang,
  dict,
  onRemove,
}: {
  swimmer: SwimmerSummary;
  lang: Locale;
  dict: Dict;
  onRemove: () => void;
}) {
  const genderLabel =
    swimmer.gender === "Men" || swimmer.gender === "Boys"
      ? dict.common.male
      : dict.common.female;

  return (
    <div className="depth-card rounded-lg border border-pool-border bg-surface p-4 dark:border-pool-border dark:bg-surface">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/${lang}/swimmer/${encodeURIComponent(swimmer.id)}`}
            className="text-sm font-semibold text-foreground hover:text-pool-mid dark:hover:text-pool-light"
          >
            {swimmer.name}
          </Link>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted dark:text-pool-light/60">
            <span className="rounded bg-pool-surface px-1.5 py-0.5 font-medium text-pool-deep dark:bg-surface-alt dark:text-pool-light">
              {swimmer.club}
            </span>
            <span>{genderLabel}</span>
          </div>
        </div>
        <button
          onClick={onRemove}
          className="shrink-0 rounded p-1 text-muted/40 hover:bg-red-50 hover:text-red-500 dark:text-pool-light/30 dark:hover:bg-red-950/30 dark:hover:text-red-400"
          title={dict.team.removeFromTeam}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Top PBs */}
      {swimmer.pbs.length > 0 ? (
        <div className="mt-3 space-y-1">
          {swimmer.pbs.map((pb, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-muted dark:text-pool-light/60">
                {pb.distance}m {pb.stroke}{" "}
                <span className="text-[10px] text-muted/50 dark:text-pool-light/40">
                  {pb.course === "LC" ? dict.team.lc : dict.team.sc}
                </span>
              </span>
              <span className="font-mono text-foreground timing-display">{pb.time}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted/50 dark:text-pool-light/30">{dict.team.noPbs}</p>
      )}
    </div>
  );
}
