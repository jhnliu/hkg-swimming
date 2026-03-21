"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "my-team";
const MAX_SWIMMERS = 50;

interface TeamState {
  swimmerIds: string[];
  teamCode: string | null;
  teamName: string | null;
}

interface TeamContextValue extends TeamState {
  addSwimmer: (id: string) => void;
  removeSwimmer: (id: string) => void;
  hasSwimmer: (id: string) => boolean;
  clearTeam: () => void;
  loadFromServer: (ids: string[], code: string, name: string | null) => void;
  setTeamCode: (code: string | null) => void;
  setTeamName: (name: string | null) => void;
  hydrated: boolean;
}

const TeamContext = createContext<TeamContextValue | null>(null);

function readStorage(): TeamState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        swimmerIds: Array.isArray(parsed.swimmerIds) ? parsed.swimmerIds : [],
        teamCode: parsed.teamCode || null,
        teamName: parsed.teamName || null,
      };
    }
  } catch {}
  return { swimmerIds: [], teamCode: null, teamName: null };
}

function writeStorage(state: TeamState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TeamState>({
    swimmerIds: [],
    teamCode: null,
    teamName: null,
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(readStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeStorage(state);
  }, [state, hydrated]);

  const addSwimmer = useCallback((id: string) => {
    setState((prev) => {
      if (prev.swimmerIds.includes(id) || prev.swimmerIds.length >= MAX_SWIMMERS) return prev;
      return { ...prev, swimmerIds: [...prev.swimmerIds, id] };
    });
  }, []);

  const removeSwimmer = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      swimmerIds: prev.swimmerIds.filter((s) => s !== id),
    }));
  }, []);

  const hasSwimmer = useCallback(
    (id: string) => state.swimmerIds.includes(id),
    [state.swimmerIds]
  );

  const clearTeam = useCallback(() => {
    setState({ swimmerIds: [], teamCode: null, teamName: null });
  }, []);

  const loadFromServer = useCallback((ids: string[], code: string, name: string | null) => {
    setState({ swimmerIds: ids.slice(0, MAX_SWIMMERS), teamCode: code, teamName: name });
  }, []);

  const setTeamCode = useCallback((code: string | null) => {
    setState((prev) => ({ ...prev, teamCode: code }));
  }, []);

  const setTeamName = useCallback((name: string | null) => {
    setState((prev) => ({ ...prev, teamName: name }));
  }, []);

  return (
    <TeamContext.Provider
      value={{
        ...state,
        addSwimmer,
        removeSwimmer,
        hasSwimmer,
        clearTeam,
        loadFromServer,
        setTeamCode,
        setTeamName,
        hydrated,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error("useTeam must be used within TeamProvider");
  return ctx;
}
