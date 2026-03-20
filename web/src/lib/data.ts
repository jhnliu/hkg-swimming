import path from "path";
import { promises as fs } from "fs";

const DATA_DIR = path.join(process.cwd(), "..", "data");

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(path.join(DATA_DIR, filePath), "utf-8");
  return JSON.parse(raw) as T;
}

// --- Types ---

export interface Swimmer {
  id: string;
  name_en: string;
  name_zh?: string;
  gender: "M" | "F";
  club_code: string;
  club_history: { club_code: string; first_seen: string; last_seen: string }[];
}

export interface Club {
  code: string;
  name_en?: string;
  name_zh?: string;
}

export interface Competition {
  id: string;
  name_en: string;
  name_zh?: string;
  date: string;
  date_end?: string;
  venue_en?: string;
  venue_zh?: string;
  course: "LC" | "SC";
  tier: string;
}

export interface SwimEvent {
  id: string;
  competition_id: string;
  event_num: number;
  gender: "M" | "F" | "mixed";
  distance: number;
  stroke: string;
  is_relay: boolean;
  age_group: string;
  standards?: Record<string, unknown>;
}

export interface Result {
  event_id: string;
  swimmer_id: string;
  swimmer_name: string;
  age: number;
  club_code: string;
  place: number | null;
  seed_time: string | null;
  finals_time: string | null;
  finals_time_seconds: number | null;
  status: "ok" | "SCR" | "DQ" | "DNS" | "DNF";
  standards_achieved: string[];
  splits: number[];
}

export interface PersonalBest {
  swimmer_id: string;
  event_key: string;
  distance: number;
  stroke: string;
  course: "LC" | "SC";
  time: string;
  time_seconds: number;
  competition_id: string;
  date: string;
  age: number;
}

export interface SwimmerProfile {
  swimmer: Swimmer;
  personal_bests: { lc: PersonalBest[]; sc: PersonalBest[] };
  competition_count: number;
  result_count: number;
  last_competed: string;
  first_competed: string;
}

export interface SearchIndex {
  swimmers: { id: string; name: string; club: string; gender: string }[];
  clubs: { code: string; name: string }[];
  competitions: { id: string; name: string; date: string; course: string }[];
}

// --- Data loaders ---

export async function getSwimmers(): Promise<Swimmer[]> {
  return readJson("swimmers.json");
}

export async function getClubs(): Promise<Club[]> {
  return readJson("clubs.json");
}

export async function getCompetitions(): Promise<Competition[]> {
  return readJson("competitions.json");
}

export async function getEvents(): Promise<SwimEvent[]> {
  return readJson("events.json");
}

export async function getResultsForCompetition(
  competitionId: string
): Promise<Result[]> {
  return readJson(`results/${competitionId}.json`);
}

export async function getSwimmerProfile(
  swimmerId: string
): Promise<SwimmerProfile> {
  // Swimmer IDs have special chars — file names use underscores
  const filename = swimmerId.replace(/[# @]/g, "_").replace(/__+/g, "_");
  return readJson(`profiles/${filename}.json`);
}

export async function getPersonalBests(): Promise<PersonalBest[]> {
  return readJson("personal_bests.json");
}

export async function getSearchIndex(): Promise<SearchIndex> {
  return readJson("search_index.json");
}

// --- Helpers ---

export function formatStroke(stroke: string): string {
  const map: Record<string, string> = {
    freestyle: "Freestyle",
    backstroke: "Backstroke",
    breaststroke: "Breaststroke",
    butterfly: "Butterfly",
    individual_medley: "Individual Medley",
    medley_relay: "Medley Relay",
    freestyle_relay: "Freestyle Relay",
  };
  return map[stroke] || stroke;
}

export function formatStrokeZh(stroke: string): string {
  const map: Record<string, string> = {
    freestyle: "自由泳",
    backstroke: "背泳",
    breaststroke: "蛙泳",
    butterfly: "蝶泳",
    individual_medley: "個人四式",
    medley_relay: "四式接力",
    freestyle_relay: "自由泳接力",
  };
  return map[stroke] || stroke;
}

export function tierLabel(tier: string, lang: "en" | "zh"): string {
  const labels: Record<string, { en: string; zh: string }> = {
    open: { en: "Open", zh: "公開賽" },
    championship: { en: "Championship", zh: "錦標賽" },
    div1: { en: "Division I", zh: "第一組" },
    div2: { en: "Division II", zh: "第二組" },
    div3: { en: "Division III", zh: "第三組" },
    timetrial: { en: "Time Trial", zh: "計時賽" },
    interport: { en: "Inter-port", zh: "埠際賽" },
    other: { en: "Other", zh: "其他" },
  };
  return labels[tier]?.[lang] || tier;
}
