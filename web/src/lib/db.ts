import { neon } from "@neondatabase/serverless";
import { unstable_cache } from "next/cache";
import clubNamesData from "./club-names.json";

const sql = neon(process.env.DATABASE_URL!);

// --- Club name lookup ---

const clubNames = clubNamesData as Record<string, { en: string; zh: string }>;

export function getClubName(code: string, lang: "en" | "zh" = "en"): string {
  return clubNames[code]?.[lang] || code;
}

// --- Helper: parse time string to seconds (done in JS instead of SQL) ---

export function parseTimeToSeconds(time: string): number {
  if (!time) return Infinity;
  const parts = time.split(":");
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  }
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(time) || Infinity;
}

// --- Types ---

export interface Swimmer {
  id: string;
  name: string;
  gender: string;
  club: string;
  club_history: { club: string; first_seen: string; last_seen: string }[];
}

export interface Competition {
  id: string;
  name: string;
  date: string;
  date_end?: string;
  course: string;
  tier: string;
}

export interface SwimEvent {
  event_num: number;
  gender: string;
  age_group: string;
  distance: string;
  stroke: string;
  course: string;
}

export interface Result {
  competition_id: string;
  competition_name: string;
  date: string;
  event_num: number;
  gender: string;
  age_group: string;
  distance: string;
  course: string;
  stroke: string;
  place: number | null;
  swimmer_id: string;
  swimmer_name: string;
  age: number | null;
  club: string;
  seed_time: string;
  finals_time: string;
  time_standard: string;
  splits: string;
}

export interface PersonalBest {
  swimmer_id: string;
  swimmer_name: string;
  club: string;
  distance: string;
  stroke: string;
  course: string;
  time: string;
  time_seconds: number;
  date: string;
  age: number;
  competition_id: string;
  competition_name?: string;
  place?: number | null;
}

// Valid competitive time: has a parsed time, not a DQ/scratch, not a relay
const VALID_TIME_FILTER = `time_seconds IS NOT NULL AND time_standard NOT IN ('SCR', 'DQ', 'DNF', 'NS') AND stroke != 'Freestyle Relay'`;

// --- Queries ---

function classifyTier(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("open")) return "open";
  if (lower.includes("championship")) return "championship";
  if (lower.includes("time trial") || name.includes("計時賽")) return "timetrial";
  if (lower.includes("div.i ") || name.includes("第一組")) return "div1";
  if (lower.includes("div.ii") || name.includes("第二組")) return "div2";
  if (lower.includes("div.iii") || name.includes("第三組")) return "div3";
  return "other";
}

export const getCompetitions = unstable_cache(
  async (): Promise<Competition[]> => {
    const rows = await sql`
      SELECT competition_id as id, competition_name as name,
        MIN(date) as date, course
      FROM results
      WHERE competition_id != ''
      GROUP BY competition_id, competition_name, course
      ORDER BY MIN(date) DESC
    `;
    return (rows as Competition[]).map((r) => ({ ...r, tier: classifyTier(r.name) }));
  },
  ["competitions"],
  { revalidate: 86400 }
);

export async function getCompetitionsPaginated(
  page: number = 1,
  limit: number = 20
): Promise<{ competitions: Competition[]; total: number }> {
  const all = await getCompetitions();
  const offset = (page - 1) * limit;
  return {
    competitions: all.slice(offset, offset + limit),
    total: all.length,
  };
}

export async function getCompetition(id: string): Promise<Competition | undefined> {
  const comps = await getCompetitions();
  return comps.find((c) => c.id === id);
}

export async function getCompetitionEvents(competitionId: string): Promise<SwimEvent[]> {
  const rows = await sql`
    SELECT DISTINCT event_num, gender, age_group, distance, stroke, course
    FROM results
    WHERE competition_id = ${competitionId}
    ORDER BY event_num
  `;
  return rows as SwimEvent[];
}

export async function getCompetitionResults(competitionId: string): Promise<Result[]> {
  const rows = await sql`
    SELECT * FROM results
    WHERE competition_id = ${competitionId}
    ORDER BY event_num,
      CASE WHEN place IS NULL THEN 1 ELSE 0 END,
      place
  `;
  return rows as Result[];
}

export async function getCompetitionResultsByEvent(
  competitionId: string,
  eventNum: number
): Promise<Result[]> {
  const rows = await sql`
    SELECT * FROM results
    WHERE competition_id = ${competitionId}
      AND event_num = ${eventNum}
    ORDER BY
      CASE WHEN place IS NULL THEN 1 ELSE 0 END,
      place
  `;
  return rows as Result[];
}

export async function getCompetitionResultsBySwimmer(
  competitionId: string,
  swimmerQuery: string
): Promise<Result[]> {
  const pattern = `%${swimmerQuery}%`;
  const rows = await sql`
    SELECT * FROM results
    WHERE competition_id = ${competitionId}
      AND REPLACE(swimmer_name, ',', '') ILIKE ${pattern}
    ORDER BY event_num,
      CASE WHEN place IS NULL THEN 1 ELSE 0 END,
      place
  `;
  return rows as Result[];
}

export async function getSwimmer(id: string): Promise<Swimmer | undefined> {
  const [rows, clubs] = await Promise.all([
    sql`
      SELECT swimmer_id as id, swimmer_name as name, gender, club
      FROM results
      WHERE swimmer_id = ${id}
      ORDER BY date DESC
      LIMIT 1
    `,
    sql`
      SELECT club, MIN(date) as first_seen, MAX(date) as last_seen
      FROM results
      WHERE swimmer_id = ${id} AND club != ''
      GROUP BY club
      ORDER BY MIN(date)
    `,
  ]);
  if (rows.length === 0) return undefined;
  const row = rows[0];

  return {
    id: row.id as string,
    name: row.name as string,
    gender: row.gender as string,
    club: row.club as string,
    club_history: clubs as { club: string; first_seen: string; last_seen: string }[],
  };
}

export async function getSwimmerResults(swimmerId: string): Promise<Result[]> {
  const rows = await sql`
    SELECT * FROM results
    WHERE swimmer_id = ${swimmerId}
    ORDER BY date DESC, event_num
  `;
  return rows as Result[];
}

export async function getSwimmerCompetitions(
  swimmerId: string
): Promise<{ id: string; name: string; date: string; course: string }[]> {
  const rows = await sql`
    SELECT DISTINCT competition_id as id, competition_name as name,
      MIN(date) as date, course
    FROM results
    WHERE swimmer_id = ${swimmerId} AND competition_id != ''
    GROUP BY competition_id, competition_name, course
    ORDER BY MIN(date) DESC
  `;
  return rows as { id: string; name: string; date: string; course: string }[];
}

export async function getSwimmerResultsInCompetition(
  swimmerId: string,
  competitionId: string
): Promise<Result[]> {
  const rows = await sql`
    SELECT * FROM results
    WHERE swimmer_id = ${swimmerId} AND competition_id = ${competitionId}
    ORDER BY event_num
  `;
  return rows as Result[];
}

export interface TimePoint {
  date: string;
  time_seconds: number;
  time: string;
  event_label: string;
  competition_name: string;
}

export async function getSwimmerTimeHistory(swimmerId: string): Promise<TimePoint[]> {
  const rows = await sql`
    SELECT date, finals_time as time,
      time_seconds,
      distance || 'm ' || stroke || ' ' || course as event_label,
      competition_name
    FROM results
    WHERE swimmer_id = ${swimmerId}
      AND ${sql.unsafe(VALID_TIME_FILTER)}
    ORDER BY date
  `;
  return rows as TimePoint[];
}

export async function getSwimmerPersonalBests(
  swimmerId: string,
  course?: "LC" | "SC"
): Promise<PersonalBest[]> {
  const courseFilter = course ? `AND course = '${course}'` : "";
  const rows = await sql`
    SELECT DISTINCT ON (distance, stroke, course)
      swimmer_id, swimmer_name, club, distance, stroke, course,
      finals_time as time,
      time_seconds,
      date, age, competition_id, competition_name, place
    FROM results
    WHERE swimmer_id = ${swimmerId}
      AND ${sql.unsafe(VALID_TIME_FILTER)}
      ${sql.unsafe(courseFilter)}
    ORDER BY distance, stroke, course, time_seconds ASC
  `;
  return rows as PersonalBest[];
}

export async function getSwimmerStats(swimmerId: string) {
  const rows = await sql`
    SELECT
      COUNT(DISTINCT competition_id) as competition_count,
      COUNT(*) as result_count,
      MIN(date) as first_competed,
      MAX(date) as last_competed
    FROM results
    WHERE swimmer_id = ${swimmerId}
  `;
  return rows[0] as {
    competition_count: number;
    result_count: number;
    first_competed: string;
    last_competed: string;
  };
}

// --- Team / batch swimmer queries ---

export interface SwimmerSummary {
  id: string;
  name: string;
  gender: string;
  club: string;
  pbs: { distance: string; stroke: string; course: string; time: string }[];
}

export async function getSwimmersSummary(ids: string[]): Promise<SwimmerSummary[]> {
  if (ids.length === 0) return [];

  const escaped = ids.map((id) => `'${id.replace(/'/g, "''")}'`).join(",");

  const [swimmers, pbs] = await Promise.all([
    sql`${sql.unsafe(`
      SELECT DISTINCT ON (swimmer_id)
        swimmer_id as id, swimmer_name as name, gender, club
      FROM results
      WHERE swimmer_id IN (${escaped})
      ORDER BY swimmer_id, date DESC
    `)}`,
    sql`${sql.unsafe(`
      SELECT DISTINCT ON (swimmer_id, distance, stroke, course)
        swimmer_id, distance, stroke, course, finals_time as time, time_seconds
      FROM results
      WHERE swimmer_id IN (${escaped})
        AND ${VALID_TIME_FILTER}
      ORDER BY swimmer_id, distance, stroke, course, time_seconds ASC
    `)}`,
  ]);

  const pbsBySwimmer = new Map<string, typeof pbs>();
  for (const pb of pbs) {
    const id = pb.swimmer_id as string;
    if (!pbsBySwimmer.has(id)) pbsBySwimmer.set(id, []);
    pbsBySwimmer.get(id)!.push(pb);
  }

  return (swimmers as Record<string, unknown>[]).map((s) => {
    const swimmerPbs = pbsBySwimmer.get(s.id as string) || [];
    // Sort by time_seconds, take top 5
    swimmerPbs.sort((a, b) => (a.time_seconds as number) - (b.time_seconds as number));
    return {
      id: s.id as string,
      name: s.name as string,
      gender: s.gender as string,
      club: s.club as string,
      pbs: swimmerPbs.slice(0, 5).map((p) => ({
        distance: p.distance as string,
        stroke: p.stroke as string,
        course: p.course as string,
        time: p.time as string,
      })),
    };
  });
}

export interface LeaderboardFilters {
  gender?: string;
  ageGroup?: string;
  season?: string;
  compType?: string;
}

async function _getLeaderboard(
  eventKey: string,
  limit: number = 20,
  filters: LeaderboardFilters = {}
): Promise<PersonalBest[]> {
  const [stroke, distance, course] = eventKey.split("_");

  const conditions: string[] = [
    `stroke = '${stroke.replace(/'/g, "''")}'`,
    `distance = '${distance.replace(/'/g, "''")}'`,
    `course = '${course.replace(/'/g, "''")}'`,
  ];

  if (filters.gender === "Male") conditions.push("gender IN ('Men', 'Boys')");
  else if (filters.gender === "Female") conditions.push("gender IN ('Women', 'Girls')");

  if (filters.ageGroup) {
    conditions.push(`age_group = '${filters.ageGroup.replace(/'/g, "''")}'`);
  }

  if (filters.season) {
    const startYear = parseInt(filters.season.split("-")[0]);
    if (!isNaN(startYear)) {
      conditions.push(`date >= '${startYear}-07-01'`);
      conditions.push(`date < '${startYear + 1}-07-01'`);
    }
  }

  if (filters.compType) {
    conditions.push(`competition_type = '${filters.compType.replace(/'/g, "''")}'`);
  }

  const where = conditions.join(" AND ");

  const rows = await sql`${sql.unsafe(`
    WITH best_times AS (
      SELECT DISTINCT ON (swimmer_id)
        swimmer_id, swimmer_name, club, distance, stroke, course,
        finals_time as time,
        time_seconds,
        date, age, competition_id
      FROM results
      WHERE ${where}
        AND ${VALID_TIME_FILTER}
      ORDER BY swimmer_id, time_seconds ASC
    )
    SELECT * FROM best_times
    ORDER BY time_seconds
    LIMIT ${limit}
  `)}`;
  return rows as unknown as PersonalBest[];
}

export async function getLeaderboard(
  eventKey: string,
  limit: number = 20,
  filters: LeaderboardFilters = {}
): Promise<PersonalBest[]> {
  const cacheKey = [
    "leaderboard",
    eventKey,
    String(limit),
    filters.gender || "",
    filters.ageGroup || "",
    filters.season || "",
    filters.compType || "",
  ];
  const cached = unstable_cache(
    () => _getLeaderboard(eventKey, limit, filters),
    cacheKey,
    { revalidate: 300 }
  );
  return cached();
}

export const getLeaderboardFilterOptions = unstable_cache(
  async (): Promise<{
    genders: string[];
    ageGroups: string[];
    seasons: string[];
  }> => {
    const [ageGroups, competitions] = await Promise.all([
      sql`SELECT DISTINCT age_group FROM results WHERE age_group != '' AND stroke != 'Freestyle Relay' ORDER BY age_group`,
      getCompetitions(),
    ]);

    // Derive seasons from cached competitions list instead of scanning results table
    const seasonSet = new Set<string>();
    for (const comp of competitions) {
      if (!comp.date) continue;
      const year = parseInt(comp.date.slice(0, 4));
      const month = parseInt(comp.date.slice(5, 7));
      const season = month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
      seasonSet.add(season);
    }
    const seasons = [...seasonSet].sort().reverse();

    return {
      genders: ["Male", "Female"],
      ageGroups: ageGroups.map((r) => r.age_group as string),
      seasons,
    };
  },
  ["leaderboard-filter-options"],
  { revalidate: 86400 }
);

export const getLeaderboardEventKeys = unstable_cache(
  async (): Promise<string[]> => {
    const rows = await sql`
      SELECT DISTINCT stroke || '_' || distance || '_' || course as event_key
      FROM results
      WHERE time_seconds IS NOT NULL
      ORDER BY event_key
    `;
    // Sort by distance numerically
    return (rows as { event_key: string }[])
      .map((r) => r.event_key)
      .sort((a, b) => {
        const [, da] = a.split("_");
        const [, db] = b.split("_");
        return parseInt(da) - parseInt(db) || a.localeCompare(b);
      });
  },
  ["leaderboard-event-keys"],
  { revalidate: 3600 }
);

export const getClubs = unstable_cache(
  async (): Promise<{ code: string; name_en: string; name_zh: string; swimmer_count: number }[]> => {
    const rows = await sql`
      SELECT club as code, COUNT(DISTINCT swimmer_id) as swimmer_count
      FROM results
      WHERE club != ''
      GROUP BY club
      ORDER BY club
    `;
    return (rows as { code: string; swimmer_count: number }[]).map((r) => ({
      ...r,
      name_en: getClubName(r.code, "en"),
      name_zh: getClubName(r.code, "zh"),
    }));
  },
  ["clubs"],
  { revalidate: 3600 }
);

export async function getClubSwimmers(
  clubCode: string
): Promise<{ id: string; name: string; gender: string }[]> {
  const rows = await sql`
    SELECT id, name, gender FROM (
      SELECT DISTINCT ON (swimmer_id)
        swimmer_id as id, swimmer_name as name, gender, date
      FROM results
      WHERE club = ${clubCode}
      ORDER BY swimmer_id, date DESC
    ) sub
    ORDER BY name
  `;
  return rows as { id: string; name: string; gender: string }[];
}

// Normalize query: strip commas/punctuation, split into words
function parseSearchWords(query: string): string[] {
  return query
    .replace(/[,.'"-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

export interface SearchResult {
  type: "swimmer" | "club" | "competition";
  id: string;
  name: string;
  subtitle: string;
}

export async function search(query: string, limit: number = 30): Promise<SearchResult[]> {
  const words = parseSearchWords(query);
  if (words.length === 0) return [];

  const results: SearchResult[] = [];
  const pattern = `%${query.trim()}%`;

  // Build swimmer name conditions
  const nameConditions = words.map((w) => `REPLACE(swimmer_name, ',', '') ILIKE '%${w.replace(/'/g, "''")}%'`).join(" AND ");

  const swimmers = await sql`
    SELECT DISTINCT ON (swimmer_id)
      swimmer_id as id, swimmer_name as name, club, gender,
      MAX(date) OVER (PARTITION BY swimmer_id) as last_date,
      COUNT(*) OVER (PARTITION BY swimmer_id) as result_count
    FROM results
    WHERE (${sql.unsafe(nameConditions)}) OR swimmer_id ILIKE ${pattern}
    ORDER BY swimmer_id, date DESC
  `;
  // Re-sort by last_date and apply limit
  swimmers.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
    (b.last_date as string).localeCompare(a.last_date as string)
  );
  swimmers.splice(limit);

  for (const s of swimmers) {
    results.push({
      type: "swimmer",
      id: s.id as string,
      name: s.name as string,
      subtitle: `${s.club} · ${s.gender} · ${s.result_count} results · last ${s.last_date}`,
    });
  }

  // Also search by full club name
  const matchingClubCodes = Object.entries(clubNames)
    .filter(([code, names]) =>
      code.toLowerCase().includes(query.trim().toLowerCase()) ||
      names.en.toLowerCase().includes(query.trim().toLowerCase()) ||
      names.zh.includes(query.trim())
    )
    .map(([code]) => code);

  const clubCodeList = matchingClubCodes.length > 0
    ? matchingClubCodes.map((c) => `'${c.replace(/'/g, "''")}'`).join(",")
    : "''";

  const clubs = await sql`${sql.unsafe(`
    SELECT club as code, COUNT(DISTINCT swimmer_id) as swimmer_count
    FROM results
    WHERE club ILIKE '${query.trim().replace(/'/g, "''")}%' OR club IN (${clubCodeList})
    GROUP BY club
    ORDER BY COUNT(DISTINCT swimmer_id) DESC
    LIMIT 5
  `)}`;

  for (const c of clubs) {
    const clubFullName = getClubName(c.code as string, "en");
    results.push({
      type: "club",
      id: c.code as string,
      name: clubFullName !== c.code ? `${clubFullName} (${c.code})` : (c.code as string),
      subtitle: `${c.swimmer_count} swimmers`,
    });
  }

  const competitions = await sql`
    SELECT DISTINCT competition_id as id, competition_name as name,
      MIN(date) as date, course
    FROM results
    WHERE competition_name ILIKE ${pattern} OR competition_id ILIKE ${pattern}
    GROUP BY competition_id, competition_name, course
    ORDER BY MIN(date) DESC
    LIMIT 5
  `;

  for (const c of competitions) {
    results.push({
      type: "competition",
      id: c.id as string,
      name: c.name as string,
      subtitle: `${c.date} · ${c.course}`,
    });
  }

  return results;
}

export async function searchSwimmers(
  query: string,
  limit: number = 10
): Promise<{ id: string; name: string; club: string }[]> {
  const words = parseSearchWords(query);
  if (words.length === 0) return [];

  const pattern = `%${query.trim()}%`;
  const nameConditions = words.map((w) => `REPLACE(swimmer_name, ',', '') ILIKE '%${w.replace(/'/g, "''")}%'`).join(" AND ");

  const rows = await sql`
    SELECT DISTINCT ON (swimmer_id)
      swimmer_id as id, swimmer_name as name, club,
      MAX(date) OVER (PARTITION BY swimmer_id) as last_date
    FROM results
    WHERE (${sql.unsafe(nameConditions)}) OR swimmer_id ILIKE ${pattern}
    ORDER BY swimmer_id, date DESC
  `;
  rows.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
    (b.last_date as string).localeCompare(a.last_date as string)
  );
  return (rows as { id: string; name: string; club: string }[]).slice(0, limit);
}

// --- Compare queries ---

export interface CompareResult {
  distance: string;
  stroke: string;
  course: string;
  swimmer1_time: string;
  swimmer1_seconds: number;
  swimmer2_time: string;
  swimmer2_seconds: number;
}

export async function getHeadToHead(
  id1: string,
  id2: string
): Promise<CompareResult[]> {
  const rows = await sql`
    WITH pb1 AS (
      SELECT DISTINCT ON (distance, stroke, course)
        distance, stroke, course, finals_time as time,
        time_seconds
      FROM results
      WHERE swimmer_id = ${id1}
        AND time_seconds IS NOT NULL
      ORDER BY distance, stroke, course, time_seconds ASC
    ),
    pb2 AS (
      SELECT DISTINCT ON (distance, stroke, course)
        distance, stroke, course, finals_time as time,
        time_seconds
      FROM results
      WHERE swimmer_id = ${id2}
        AND time_seconds IS NOT NULL
      ORDER BY distance, stroke, course, time_seconds ASC
    )
    SELECT pb1.distance, pb1.stroke, pb1.course,
      pb1.time as swimmer1_time, pb1.time_seconds as swimmer1_seconds,
      pb2.time as swimmer2_time, pb2.time_seconds as swimmer2_seconds
    FROM pb1
    INNER JOIN pb2 ON pb1.distance = pb2.distance AND pb1.stroke = pb2.stroke AND pb1.course = pb2.course
    ORDER BY CAST(pb1.distance AS INTEGER), pb1.stroke, pb1.course
  `;
  return rows as CompareResult[];
}

// --- Trends queries ---

export interface Improver {
  swimmer_id: string;
  swimmer_name: string;
  club: string;
  distance: string;
  stroke: string;
  course: string;
  old_time: string;
  old_seconds: number;
  new_time: string;
  new_seconds: number;
  improvement_pct: number;
  old_date: string;
  new_date: string;
  days_between: number;
}

export interface ImproverFilters {
  stroke?: string;
  course?: string;
  gender?: string;
  club?: string;
}

export async function getBiggestImprovers(
  limit: number = 25,
  filters: ImproverFilters = {}
): Promise<Improver[]> {
  const conditions: string[] = [
    "time_seconds IS NOT NULL",
    "date >= (CURRENT_DATE - INTERVAL '12 months')::TEXT",
  ];

  if (filters.stroke) conditions.push(`stroke = '${filters.stroke.replace(/'/g, "''")}'`);
  if (filters.course) conditions.push(`course = '${filters.course.replace(/'/g, "''")}'`);
  if (filters.gender === "Male") conditions.push("gender IN ('Men', 'Boys')");
  else if (filters.gender === "Female") conditions.push("gender IN ('Women', 'Girls')");
  if (filters.club) conditions.push(`club = '${filters.club.replace(/'/g, "''")}'`);

  const where = conditions.join(" AND ");

  const cacheKey = [
    "improvers",
    filters.stroke || "",
    filters.course || "",
    filters.gender || "",
    filters.club || "",
    String(limit),
  ];
  const cached = unstable_cache(
    async () => {
      const rows = await sql`${sql.unsafe(`
        WITH recent AS (
          SELECT swimmer_id, swimmer_name, club, distance, stroke, course,
            finals_time, date, time_seconds,
            ROW_NUMBER() OVER (PARTITION BY swimmer_id, distance, stroke, course ORDER BY date ASC) as rn_earliest,
            ROW_NUMBER() OVER (PARTITION BY swimmer_id, distance, stroke, course ORDER BY date DESC) as rn_latest
          FROM results
          WHERE ${where}
        ),
        improvements AS (
          SELECT e.swimmer_id, e.swimmer_name, e.club,
            e.distance, e.stroke, e.course,
            e.finals_time as old_time, e.time_seconds as old_seconds, e.date as old_date,
            l.finals_time as new_time, l.time_seconds as new_seconds, l.date as new_date,
            ROUND(((e.time_seconds - l.time_seconds) / e.time_seconds * 100)::NUMERIC, 2) as improvement_pct,
            (l.date::DATE - e.date::DATE) as days_between
          FROM recent e
          JOIN recent l ON e.swimmer_id = l.swimmer_id
            AND e.distance = l.distance AND e.stroke = l.stroke AND e.course = l.course
            AND l.rn_latest = 1
          WHERE e.rn_earliest = 1
            AND l.time_seconds < e.time_seconds
            AND e.date != l.date
        )
        SELECT swimmer_id, swimmer_name, club,
          distance, stroke, course,
          old_time, old_seconds, new_time, new_seconds,
          improvement_pct, old_date, new_date, days_between
        FROM improvements
        ORDER BY improvement_pct DESC
        LIMIT ${limit}
      `)}`;
      return rows as unknown as Improver[];
    },
    cacheKey,
    { revalidate: 3600 }
  );
  return cached();
}

export const getTrendFilterOptions = unstable_cache(
  async (): Promise<{
    strokes: string[];
    courses: string[];
    genders: string[];
    clubs: string[];
  }> => {
    const [strokes, courses, clubs] = await Promise.all([
      sql`SELECT DISTINCT stroke FROM results WHERE stroke != 'Freestyle Relay' AND stroke != '' ORDER BY stroke`,
      sql`SELECT DISTINCT course FROM results WHERE course != '' ORDER BY course`,
      sql`SELECT club, COUNT(DISTINCT swimmer_id) as cnt FROM results WHERE club != '' GROUP BY club HAVING COUNT(DISTINCT swimmer_id) >= 5 ORDER BY club`,
    ]);

    return {
      strokes: strokes.map((r) => r.stroke as string),
      courses: courses.map((r) => r.course as string),
      genders: ["Male", "Female"],
      clubs: clubs.map((r) => r.club as string),
    };
  },
  ["trend-filter-options"],
  { revalidate: 3600 }
);

export interface Breakthrough {
  swimmer_id: string;
  swimmer_name: string;
  club: string;
  distance: string;
  stroke: string;
  course: string;
  finals_time: string;
  time_standard: string;
  date: string;
  competition_name: string;
  age: number;
}

export const getBreakthroughSwims = unstable_cache(
  async (limit: number = 20): Promise<Breakthrough[]> => {
    const rows = await sql`
      WITH standard_results AS (
      SELECT swimmer_id, swimmer_name, club, distance, stroke, course,
        finals_time, time_standard, date, competition_name, age,
        ROW_NUMBER() OVER (
          PARTITION BY swimmer_id, distance, stroke, course
          ORDER BY date ASC
        ) as rn
      FROM results
      WHERE time_standard IN ('D1', 'QT', 'A', 'B', 'AQT')
        AND finals_time != '' AND finals_time IS NOT NULL
        AND stroke != 'Freestyle Relay'
    )
    SELECT swimmer_id, swimmer_name, club, distance, stroke, course,
      finals_time, time_standard, date, competition_name, age
    FROM standard_results
    WHERE rn = 1
    ORDER BY date DESC
    LIMIT ${limit}
  `;
    return rows as Breakthrough[];
  },
  ["breakthroughs"],
  { revalidate: 3600 }
);

// --- Stats ---

export interface DbStats {
  total_results: number;
  total_swimmers: number;
  total_clubs: number;
  total_competitions: number;
  date_from: string;
  date_to: string;
}

export const getDbStats = unstable_cache(
  async (): Promise<DbStats> => {
    const [mainRows, hkssfRows] = await Promise.all([
      sql`
        SELECT
          COUNT(*) as total_results,
          COUNT(DISTINCT swimmer_id) as total_swimmers,
          COUNT(DISTINCT club) as total_clubs,
          COUNT(DISTINCT competition_id) as total_competitions,
          MIN(date) as date_from,
          MAX(date) as date_to
        FROM results
        WHERE swimmer_id != ''
      `,
      sql`
        SELECT
          COUNT(*) as total_results,
          COUNT(DISTINCT competition_id) as total_competitions,
          MIN(date) as date_from,
          MAX(date) as date_to
        FROM hkssf_results
      `,
    ]);
    const main = mainRows[0] as Record<string, string>;
    const hkssf = hkssfRows[0] as Record<string, string>;
    const dateFrom = main.date_from < hkssf.date_from ? main.date_from : hkssf.date_from;
    const dateTo = main.date_to > hkssf.date_to ? main.date_to : hkssf.date_to;
    return {
      total_results: Number(main.total_results) + Number(hkssf.total_results),
      total_swimmers: Number(main.total_swimmers),
      total_clubs: Number(main.total_clubs),
      total_competitions: Number(main.total_competitions) + Number(hkssf.total_competitions),
      date_from: dateFrom,
      date_to: dateTo,
    } as DbStats;
  },
  ["db-stats"],
  { revalidate: 86400 }
);

// --- Club analytics ---

export interface ClubSeasonStats {
  season: string;
  swimmer_count: number;
  result_count: number;
  gold: number;
  silver: number;
  bronze: number;
  male_count: number;
  female_count: number;
}

export interface ClubStrokeStrength {
  stroke: string;
  avg_place: number;
  result_count: number;
  medal_count: number;
}

export async function getClubAnalytics(clubCode: string) {
  const [seasonStats, strokeStrength, totalsRows] = await Promise.all([
    sql`
      SELECT
        CASE WHEN CAST(SUBSTRING(date FROM 6 FOR 2) AS INTEGER) >= 7
          THEN SUBSTRING(date FROM 1 FOR 4) || '-' || (CAST(SUBSTRING(date FROM 1 FOR 4) AS INTEGER) + 1)
          ELSE (CAST(SUBSTRING(date FROM 1 FOR 4) AS INTEGER) - 1) || '-' || SUBSTRING(date FROM 1 FOR 4)
        END as season,
        COUNT(DISTINCT swimmer_id) as swimmer_count,
        COUNT(*) as result_count,
        SUM(CASE WHEN place = 1 THEN 1 ELSE 0 END) as gold,
        SUM(CASE WHEN place = 2 THEN 1 ELSE 0 END) as silver,
        SUM(CASE WHEN place = 3 THEN 1 ELSE 0 END) as bronze,
        COUNT(DISTINCT CASE WHEN gender IN ('Men', 'Boys') THEN swimmer_id END) as male_count,
        COUNT(DISTINCT CASE WHEN gender IN ('Women', 'Girls') THEN swimmer_id END) as female_count
      FROM results
      WHERE club = ${clubCode} AND date != ''
      GROUP BY season
      ORDER BY season
    `,
    sql`
      SELECT stroke,
        ROUND(AVG(place)::NUMERIC, 1) as avg_place,
        COUNT(*) as result_count,
        SUM(CASE WHEN place <= 3 THEN 1 ELSE 0 END) as medal_count
      FROM results
      WHERE club = ${clubCode} AND place IS NOT NULL AND place > 0
        AND stroke != 'Freestyle Relay'
      GROUP BY stroke
      HAVING COUNT(*) >= 5
      ORDER BY AVG(place) ASC
    `,
    sql`
      SELECT
        COUNT(DISTINCT swimmer_id) as total_swimmers,
        COUNT(DISTINCT competition_id) as total_competitions,
        COUNT(*) as total_results,
        SUM(CASE WHEN place = 1 THEN 1 ELSE 0 END) as total_gold,
        SUM(CASE WHEN place = 2 THEN 1 ELSE 0 END) as total_silver,
        SUM(CASE WHEN place = 3 THEN 1 ELSE 0 END) as total_bronze,
        MIN(date) as first_result,
        MAX(date) as last_result
      FROM results
      WHERE club = ${clubCode}
    `,
  ]);

  return {
    seasonStats: seasonStats as ClubSeasonStats[],
    strokeStrength: strokeStrength as ClubStrokeStrength[],
    totals: totalsRows[0] as {
      total_swimmers: number;
      total_competitions: number;
      total_results: number;
      total_gold: number;
      total_silver: number;
      total_bronze: number;
      first_result: string;
      last_result: string;
    },
  };
}

// --- Feedback ---

export interface FeedbackItem {
  id: number;
  name: string;
  category: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
}

export async function getFeedback(): Promise<FeedbackItem[]> {
  const rows = await sql`
    SELECT id, name, category, title, description, status, created_at::TEXT
    FROM feedback
    ORDER BY created_at DESC
  `;
  return rows as FeedbackItem[];
}

export async function submitFeedback(data: {
  name: string;
  category: string;
  title: string;
  description: string;
}): Promise<FeedbackItem> {
  const rows = await sql`
    INSERT INTO feedback (name, category, title, description)
    VALUES (${data.name || "Anonymous"}, ${data.category}, ${data.title}, ${data.description})
    RETURNING id, name, category, title, description, status, created_at::TEXT
  `;
  return rows[0] as FeedbackItem;
}

export async function updateFeedbackStatus(
  id: number,
  status: string,
  adminNote: string
): Promise<void> {
  await sql`
    UPDATE feedback
    SET status = ${status}
    WHERE id = ${id}
  `;
}

// --- Appeals ---

export interface AppealItem {
  id: number;
  appeal_type: string;
  submitter_name: string;
  submitter_email: string | null;
  swimmer_name: string;
  swimmer_id: string | null;
  competition_name: string | null;
  event_description: string | null;
  recorded_time: string | null;
  reason: string;
  requested_change: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export async function getAppeals(): Promise<AppealItem[]> {
  const rows = await sql`
    SELECT id, appeal_type, submitter_name, submitter_email, swimmer_name, swimmer_id,
      competition_name, event_description, recorded_time, reason,
      requested_change, status, admin_note, created_at::TEXT, reviewed_at::TEXT
    FROM appeals
    ORDER BY created_at DESC
  `;
  return rows as AppealItem[];
}

export async function getAppealsByStatus(status: string): Promise<AppealItem[]> {
  const rows = await sql`
    SELECT id, appeal_type, submitter_name, submitter_email, swimmer_name, swimmer_id,
      competition_name, event_description, recorded_time, reason,
      requested_change, status, admin_note, created_at::TEXT, reviewed_at::TEXT
    FROM appeals
    WHERE status = ${status}
    ORDER BY created_at DESC
  `;
  return rows as AppealItem[];
}

export async function submitAppeal(data: {
  appeal_type: string;
  submitter_name: string;
  submitter_email: string;
  swimmer_name: string;
  swimmer_id: string;
  competition_name: string;
  event_description: string;
  recorded_time: string;
  reason: string;
  requested_change: string;
}): Promise<AppealItem> {
  const rows = await sql`
    INSERT INTO appeals (appeal_type, submitter_name, submitter_email, swimmer_name, swimmer_id,
      competition_name, event_description, recorded_time, reason, requested_change)
    VALUES (${data.appeal_type || "correction"}, ${data.submitter_name || "Anonymous"},
      ${data.submitter_email || null},
      ${data.swimmer_name}, ${data.swimmer_id || null}, ${data.competition_name || null},
      ${data.event_description || null}, ${data.recorded_time || null},
      ${data.reason}, ${data.requested_change})
    RETURNING id, appeal_type, submitter_name, submitter_email, swimmer_name, swimmer_id,
      competition_name, event_description, recorded_time, reason,
      requested_change, status, admin_note, created_at::TEXT, reviewed_at::TEXT
  `;
  return rows[0] as AppealItem;
}

export async function reviewAppeal(
  id: number,
  status: "approved" | "rejected",
  adminNote: string
): Promise<AppealItem> {
  const rows = await sql`
    UPDATE appeals
    SET status = ${status}, admin_note = ${adminNote}, reviewed_at = NOW()
    WHERE id = ${id}
    RETURNING id, appeal_type, submitter_name, submitter_email, swimmer_name, swimmer_id,
      competition_name, event_description, recorded_time, reason,
      requested_change, status, admin_note, created_at::TEXT, reviewed_at::TEXT
  `;
  return rows[0] as AppealItem;
}

// --- HKSSF Inter-School ---

export interface HkssfCompetition {
  id: string;
  name: string;
  date: string;
  season: string;
  division: string;
  region: string;
}

export interface HkssfResult {
  competition_id: string;
  competition_name: string;
  date: string;
  event_num: number;
  gender: string;
  age_group: string;
  distance: string;
  course: string;
  stroke: string;
  place: number | null;
  swimmer_name: string;
  club: string;
  finals_time: string;
  time_standard: string;
  time_seconds: number | null;
  season: string;
  division: string;
  region: string;
  heat: string;
  points: number | null;
  record: string;
}

export interface HkssfSchoolRanking {
  club: string;
  gold: number;
  silver: number;
  bronze: number;
  total_points: number;
  result_count: number;
}

export const getHkssfCompetitions = unstable_cache(
  async (): Promise<HkssfCompetition[]> => {
    const rows = await sql`
      SELECT competition_id as id, competition_name as name,
        MIN(date) as date, season, division,
        MIN(region) as region
      FROM hkssf_results
      WHERE competition_id != ''
      GROUP BY competition_id, competition_name, season, division
      ORDER BY MIN(date) DESC
    `;
    return rows as HkssfCompetition[];
  },
  ["hkssf-competitions"],
  { revalidate: 86400 }
);

export async function getHkssfCompetitionsPaginated(
  page: number = 1,
  limit: number = 20,
  filters: { season?: string; division?: string } = {}
): Promise<{ competitions: HkssfCompetition[]; total: number }> {
  let all = await getHkssfCompetitions();
  if (filters.season) all = all.filter((c) => c.season === filters.season);
  if (filters.division) all = all.filter((c) => c.division === filters.division);
  const offset = (page - 1) * limit;
  return {
    competitions: all.slice(offset, offset + limit),
    total: all.length,
  };
}

export async function getHkssfCompetition(id: string): Promise<HkssfCompetition | undefined> {
  const comps = await getHkssfCompetitions();
  return comps.find((c) => c.id === id);
}

export interface HkssfEvent {
  gender: string;
  age_group: string;
  distance: string;
  stroke: string;
  course: string;
  has_heats: boolean;
}

export async function getHkssfCompetitionEvents(competitionId: string): Promise<HkssfEvent[]> {
  const rows = await sql`
    SELECT gender, age_group, distance, stroke, course,
      BOOL_OR(heat LIKE 'Heat%') as has_heats
    FROM hkssf_results
    WHERE competition_id = ${competitionId}
    GROUP BY gender, age_group, distance, stroke, course
    ORDER BY MIN(event_num), gender, age_group
  `;
  return rows as HkssfEvent[];
}

export async function getHkssfCompetitionResultsByEventKey(
  competitionId: string,
  gender: string,
  ageGroup: string,
  distance: string,
  stroke: string
): Promise<HkssfResult[]> {
  const rows = await sql`
    SELECT competition_id, competition_name, date, event_num, gender, age_group,
      distance, course, stroke, place, swimmer_name, club, finals_time,
      time_standard, time_seconds, season, division, region, heat, points, record
    FROM hkssf_results
    WHERE competition_id = ${competitionId}
      AND gender = ${gender}
      AND age_group = ${ageGroup}
      AND distance = ${distance}
      AND stroke = ${stroke}
    ORDER BY
      CASE WHEN time_seconds IS NULL THEN 1 ELSE 0 END,
      time_seconds
  `;
  return rows as HkssfResult[];
}

export async function getHkssfCompetitionResultsBySwimmer(
  competitionId: string,
  swimmerQuery: string
): Promise<HkssfResult[]> {
  const pattern = `%${swimmerQuery}%`;
  const rows = await sql`
    SELECT competition_id, competition_name, date, event_num, gender, age_group,
      distance, course, stroke, place, swimmer_name, club, finals_time,
      time_standard, time_seconds, season, division, region, heat, points, record
    FROM hkssf_results
    WHERE competition_id = ${competitionId}
      AND REPLACE(swimmer_name, ',', '') ILIKE ${pattern}
    ORDER BY event_num,
      CASE WHEN place IS NULL THEN 1 ELSE 0 END,
      place
  `;
  return rows as HkssfResult[];
}

export async function getHkssfSchoolRankings(
  season?: string,
  division?: string
): Promise<HkssfSchoolRanking[]> {
  const conditions: string[] = ["time_seconds IS NOT NULL"];
  if (season) conditions.push(`season = '${season.replace(/'/g, "''")}'`);
  if (division) conditions.push(`division = '${division.replace(/'/g, "''")}'`);
  const where = conditions.join(" AND ");

  const cacheKey = ["hkssf-rankings", season || "", division || ""];
  const cached = unstable_cache(
    async () => {
      const rows = await sql`${sql.unsafe(`
        SELECT club,
          COUNT(*) FILTER (WHERE place = 1) as gold,
          COUNT(*) FILTER (WHERE place = 2) as silver,
          COUNT(*) FILTER (WHERE place = 3) as bronze,
          COALESCE(SUM(points), 0) as total_points,
          COUNT(*) as result_count
        FROM hkssf_results
        WHERE ${where}
        GROUP BY club
        ORDER BY total_points DESC, gold DESC, silver DESC, bronze DESC
      `)}`;
      return rows as unknown as HkssfSchoolRanking[];
    },
    cacheKey,
    { revalidate: 3600 }
  );
  return cached();
}

export interface HkssfLeaderboardFilters {
  gender?: string;
  ageGroup?: string;
  season?: string;
  division?: string;
}

async function _getHkssfLeaderboard(
  eventKey: string,
  limit: number = 25,
  filters: HkssfLeaderboardFilters = {}
): Promise<PersonalBest[]> {
  const [stroke, distance] = eventKey.split("_");

  const conditions: string[] = [
    `stroke = '${stroke.replace(/'/g, "''")}'`,
    `distance = '${distance.replace(/'/g, "''")}'`,
    "time_seconds IS NOT NULL",
  ];

  if (filters.gender === "M") conditions.push("gender = 'M'");
  else if (filters.gender === "F") conditions.push("gender = 'F'");

  if (filters.ageGroup) {
    conditions.push(`age_group = '${filters.ageGroup.replace(/'/g, "''")}'`);
  }
  if (filters.season) {
    conditions.push(`season = '${filters.season.replace(/'/g, "''")}'`);
  }
  if (filters.division) {
    conditions.push(`division = '${filters.division.replace(/'/g, "''")}'`);
  }

  const where = conditions.join(" AND ");

  const rows = await sql`${sql.unsafe(`
    WITH best_times AS (
      SELECT DISTINCT ON (swimmer_name, club)
        '' as swimmer_id, swimmer_name, club, distance, stroke, course,
        finals_time as time,
        time_seconds,
        date, age, competition_id
      FROM hkssf_results
      WHERE ${where}
      ORDER BY swimmer_name, club, time_seconds ASC
    )
    SELECT * FROM best_times
    ORDER BY time_seconds
    LIMIT ${limit}
  `)}`;
  return rows as unknown as PersonalBest[];
}

export async function getHkssfLeaderboard(
  eventKey: string,
  limit: number = 25,
  filters: HkssfLeaderboardFilters = {}
): Promise<PersonalBest[]> {
  const cacheKey = [
    "hkssf-leaderboard",
    eventKey,
    String(limit),
    filters.gender || "",
    filters.ageGroup || "",
    filters.season || "",
    filters.division || "",
  ];
  const cached = unstable_cache(
    () => _getHkssfLeaderboard(eventKey, limit, filters),
    cacheKey,
    { revalidate: 300 }
  );
  return cached();
}

export const getHkssfLeaderboardEventKeys = unstable_cache(
  async (): Promise<string[]> => {
    const rows = await sql`
      SELECT DISTINCT stroke || '_' || distance || '_LC' as event_key
      FROM hkssf_results
      WHERE time_seconds IS NOT NULL
      ORDER BY event_key
    `;
    return (rows as { event_key: string }[])
      .map((r) => r.event_key)
      .sort((a, b) => {
        const [, da] = a.split("_");
        const [, db] = b.split("_");
        return parseInt(da) - parseInt(db) || a.localeCompare(b);
      });
  },
  ["hkssf-leaderboard-event-keys"],
  { revalidate: 3600 }
);

export const getHkssfFilterOptions = unstable_cache(
  async (): Promise<{
    seasons: string[];
    divisions: string[];
    ageGroups: string[];
  }> => {
    const [seasons, divisions, ageGroups] = await Promise.all([
      sql`SELECT DISTINCT season FROM hkssf_results ORDER BY season DESC`,
      sql`SELECT DISTINCT division FROM hkssf_results ORDER BY division`,
      sql`SELECT DISTINCT age_group FROM hkssf_results WHERE age_group != '' ORDER BY age_group`,
    ]);
    return {
      seasons: seasons.map((r) => r.season as string),
      divisions: divisions.map((r) => r.division as string),
      ageGroups: ageGroups.map((r) => r.age_group as string),
    };
  },
  ["hkssf-filter-options"],
  { revalidate: 86400 }
);

export async function getHkssfSchoolDetail(
  schoolCode: string,
  season?: string
): Promise<{
  results: HkssfResult[];
  totals: { total_results: number; gold: number; silver: number; bronze: number; total_points: number; seasons: number };
}> {
  const seasonFilter = season ? `AND season = '${season.replace(/'/g, "''")}'` : "";

  const [results, totalsRows] = await Promise.all([
    sql`${sql.unsafe(`
      SELECT competition_id, competition_name, date, event_num, gender, age_group,
        distance, course, stroke, place, swimmer_name, club, finals_time,
        time_standard, time_seconds, season, division, region, heat, points, record
      FROM hkssf_results
      WHERE club = '${schoolCode.replace(/'/g, "''")}' ${seasonFilter}
      ORDER BY date DESC, event_num
    `)}`,
    sql`${sql.unsafe(`
      SELECT
        COUNT(*) as total_results,
        SUM(CASE WHEN place = 1 THEN 1 ELSE 0 END) as gold,
        SUM(CASE WHEN place = 2 THEN 1 ELSE 0 END) as silver,
        SUM(CASE WHEN place = 3 THEN 1 ELSE 0 END) as bronze,
        COALESCE(SUM(points), 0) as total_points,
        COUNT(DISTINCT season) as seasons
      FROM hkssf_results
      WHERE club = '${schoolCode.replace(/'/g, "''")}' ${seasonFilter}
    `)}`,
  ]);

  return {
    results: results as HkssfResult[],
    totals: totalsRows[0] as {
      total_results: number;
      gold: number;
      silver: number;
      bronze: number;
      total_points: number;
      seasons: number;
    },
  };
}

export function divisionLabel(division: string, region: string, lang: "en" | "zh"): string {
  if (division === "1") return lang === "en" ? "Division 1" : "第一組";
  if (division === "2") return lang === "en" ? "Division 2" : "第二組";
  if (division === "3") {
    const regionLabel = lang === "en" ? region : (
      region === "Hong Kong Island" ? "港島" :
      region === "Kowloon 1" ? "九龍一" :
      region === "Kowloon 2" ? "九龍二" : region
    );
    return lang === "en" ? `Division 3 (${regionLabel})` : `第三組（${regionLabel}）`;
  }
  return division;
}

export function formatHkssfStroke(stroke: string): string {
  const map: Record<string, string> = {
    freestyle: "Freestyle",
    backstroke: "Backstroke",
    breaststroke: "Breaststroke",
    butterfly: "Butterfly",
    individual_medley: "Individual Medley",
    freestyle_relay: "Freestyle Relay",
    medley_relay: "Medley Relay",
  };
  return map[stroke] || stroke;
}

export function formatHkssfStrokeZh(stroke: string): string {
  const map: Record<string, string> = {
    freestyle: "自由泳",
    backstroke: "背泳",
    breaststroke: "蛙泳",
    butterfly: "蝶泳",
    individual_medley: "個人四式",
    freestyle_relay: "自由泳接力",
    medley_relay: "四式接力",
  };
  return map[stroke] || stroke;
}

// --- Formatting helpers ---

export function formatStroke(stroke: string): string {
  const map: Record<string, string> = {
    Freestyle: "Freestyle",
    Backstroke: "Backstroke",
    Breaststroke: "Breaststroke",
    Butterfly: "Butterfly",
    IM: "Individual Medley",
    "Freestyle Relay": "Freestyle Relay",
  };
  return map[stroke] || stroke;
}

export function formatStrokeZh(stroke: string): string {
  const map: Record<string, string> = {
    Freestyle: "自由泳",
    Backstroke: "背泳",
    Breaststroke: "蛙泳",
    Butterfly: "蝶泳",
    IM: "個人四式",
    "Freestyle Relay": "自由泳接力",
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
