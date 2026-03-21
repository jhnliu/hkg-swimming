"use client";

import { useState, useEffect } from "react";
import { useTeam } from "@/components/team-provider";

export function AddToTeamButton({
  swimmerId,
  dict,
}: {
  swimmerId: string;
  dict: { addToTeam: string; removeFromTeam: string; addedToTeam: string };
}) {
  const { addSwimmer, removeSwimmer, hasSwimmer, hydrated } = useTeam();
  const [flash, setFlash] = useState(false);
  const inTeam = hasSwimmer(swimmerId);

  useEffect(() => {
    if (flash) {
      const t = setTimeout(() => setFlash(false), 1500);
      return () => clearTimeout(t);
    }
  }, [flash]);

  if (!hydrated) return null;

  if (inTeam) {
    return (
      <button
        onClick={() => removeSwimmer(swimmerId)}
        className="flex items-center gap-1 rounded-md border border-pool-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-red-50 hover:text-red-600 dark:border-pool-border dark:text-pool-light/60 dark:hover:bg-red-950/30 dark:hover:text-red-400"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        {dict.removeFromTeam}
      </button>
    );
  }

  return (
    <button
      onClick={() => {
        addSwimmer(swimmerId);
        setFlash(true);
      }}
      className="flex items-center gap-1 rounded-md bg-pool-mid px-3 py-1.5 text-xs font-medium text-white hover:bg-pool-deep"
    >
      {flash ? (
        dict.addedToTeam
      ) : (
        <>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {dict.addToTeam}
        </>
      )}
    </button>
  );
}
