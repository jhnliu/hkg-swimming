/**
 * HKG Swimming Data Platform — JSON Data Schema
 *
 * This defines the shape of pre-built JSON files consumed by the Next.js frontend.
 * The PDF parser outputs data conforming to these types.
 */

// --- Core entities ---

export interface Swimmer {
  /** HK Swimming registration ID (e.g. "44674 B", "48574 @IAZ", "50583 @P") */
  id: string;
  /** Full name in English as it appears in results */
  name_en: string;
  /** Full name in Chinese (if available from PDFs) */
  name_zh?: string;
  /** Derived from event headers (Men/Boys = M, Women/Girls = F) */
  gender: "M" | "F";
  /** Most recent club code */
  club_code: string;
  /** All club codes this swimmer has been associated with, chronologically */
  club_history: {
    club_code: string;
    /** ISO date of first appearance with this club */
    first_seen: string;
    /** ISO date of last appearance with this club */
    last_seen: string;
  }[];
}

export interface Club {
  /** 3-letter club code (e.g. "HTA", "WTS", "SCA") */
  code: string;
  /** Full club name in English (if known) */
  name_en?: string;
  /** Full club name in Chinese (if known) */
  name_zh?: string;
}

export interface Competition {
  /** From the website event ID (e.g. "5332") */
  id: string;
  /** Competition name in English */
  name_en: string;
  /** Competition name in Chinese */
  name_zh?: string;
  /** ISO date (or start date for multi-day meets, e.g. "2026-03-14") */
  date: string;
  /** End date for multi-day meets */
  date_end?: string;
  /** Venue name in English */
  venue_en?: string;
  /** Venue name in Chinese */
  venue_zh?: string;
  /** LC = long course (50m), SC = short course (25m) */
  course: "LC" | "SC";
  /**
   * Competition tier:
   * - "open" = HK Open Championships
   * - "championship" = Age Group Swimming Championships (錦標賽)
   * - "div1" / "div2" / "div3" = Division/Group 1/2/3 age group meets
   * - "timetrial" = Festival of Sport or other time trials
   * - "interport" = Inter-port meets (港澳埠際)
   * - "other"
   */
  tier: "open" | "championship" | "div1" | "div2" | "div3" | "timetrial" | "interport" | "other";
}

// --- Event & Results ---

export interface Event {
  /** Composite key: "{competition_id}_{event_num}" (e.g. "5332_1") */
  id: string;
  competition_id: string;
  /** Event number as printed in results (e.g. 1, 2, 39) */
  event_num: number;
  gender: "M" | "F" | "mixed";
  /** Distance in meters */
  distance: number;
  /** Normalized stroke name */
  stroke: "freestyle" | "backstroke" | "breaststroke" | "butterfly" | "individual_medley" | "medley_relay" | "freestyle_relay";
  /** True if this is a relay event */
  is_relay: boolean;
  /** Age group as printed (e.g. "13 & 14 YRS", "15 -17 YRS", "8 YRS & UNDER", "Open") */
  age_group: string;
  /** Qualifying standards for this event */
  standards?: EventStandards;
}

export interface EventStandards {
  /** HK Record */
  hkr?: { time: string; holder?: string; club?: string };
  /** World Aquatics A standard */
  wca?: string;
  /** World Aquatics B standard */
  wcb?: string;
  /** Junior Record */
  jr?: { time: string };
  /** Meet Record */
  mr?: { time: string; holder?: string; club?: string };
  /** D1 Qualifying Time */
  d1?: string;
  /** QT (general qualifying time) */
  qt?: string;
  /** Meet qualifying time range */
  meet_qualifying?: { min: string; max: string };
}

export interface Result {
  /** References Event.id */
  event_id: string;
  /** References Swimmer.id (null for relay leadoff or unmatched) */
  swimmer_id: string;
  /** Swimmer name as printed (for display / fallback) */
  swimmer_name: string;
  /** Age at time of competition */
  age: number;
  /** Club code at time of competition */
  club_code: string;
  /** Finishing place (null if SCR, DQ, DNS, etc.) */
  place: number | null;
  /** Seed/entry time in "MM:SS.ss" or "HH:MM:SS.ss" format (null if NT) */
  seed_time: string | null;
  /** Finals time in same format (null if SCR, DNS) */
  finals_time: string | null;
  /** Time in seconds for sorting/computation */
  finals_time_seconds: number | null;
  /**
   * Result status:
   * - "ok" = normal finish
   * - "SCR" = scratched (did not start)
   * - "DQ" = disqualified
   * - "DNS" = did not start
   * - "DNF" = did not finish
   */
  status: "ok" | "SCR" | "DQ" | "DNS" | "DNF";
  /**
   * Standards achieved (e.g. ["D1"], ["QT"], ["H", "J"])
   * H = HK Record, J = Junior Record, M = Meet Record,
   * A = WCA, B = WCB, D1 = Division 1 qualifying, QT = qualifying time
   */
  standards_achieved: string[];
  /** Split times in seconds, ordered by distance (e.g. [30.23, 62.83, ...] for each 50m) */
  splits: number[];
}

// --- Derived / pre-computed for the UI ---

export interface PersonalBest {
  swimmer_id: string;
  /** Stroke + distance + course combo (e.g. "freestyle_100_SC") */
  event_key: string;
  distance: number;
  stroke: string;
  course: "LC" | "SC";
  /** Best time in "MM:SS.ss" format */
  time: string;
  /** Best time in seconds */
  time_seconds: number;
  /** Competition where PB was set */
  competition_id: string;
  /** ISO date of the PB */
  date: string;
  /** Age when PB was set */
  age: number;
}

export interface SwimmerProfile {
  swimmer: Swimmer;
  personal_bests: {
    lc: PersonalBest[];
    sc: PersonalBest[];
  };
  /** Total number of competitions entered */
  competition_count: number;
  /** Total number of individual results */
  result_count: number;
  /** Date of most recent competition */
  last_competed: string;
  /** Date of first competition in our data */
  first_competed: string;
}

// --- Data files structure ---

/**
 * Pre-built JSON files at build time:
 *
 * /data/swimmers.json        → Swimmer[]
 * /data/clubs.json            → Club[]
 * /data/competitions.json     → Competition[]
 * /data/events.json           → Event[]
 * /data/results/{comp_id}.json → Result[]  (one file per competition)
 * /data/profiles/{swimmer_id}.json → SwimmerProfile  (one file per swimmer)
 * /data/personal_bests.json   → PersonalBest[]  (all PBs, for leaderboards)
 * /data/search_index.json     → Fuse.js index (swimmers + clubs + competitions)
 */
