import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

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
}

// --- Time conversion SQL fragment for Postgres ---

// Strip trailing non-numeric chars (e.g. "55.80S" -> "55.80") before parsing
const CLEAN_TIME = `REGEXP_REPLACE(finals_time, '[^0-9:.]+$', '')`;

const TIME_TO_SECONDS = `
  CASE
    WHEN ${CLEAN_TIME} ~ '^[0-9]+:[0-9]+:[0-9.]+$' THEN
      CAST(SPLIT_PART(${CLEAN_TIME}, ':', 1) AS DOUBLE PRECISION) * 3600 +
      CAST(SPLIT_PART(${CLEAN_TIME}, ':', 2) AS DOUBLE PRECISION) * 60 +
      CAST(SPLIT_PART(${CLEAN_TIME}, ':', 3) AS DOUBLE PRECISION)
    WHEN ${CLEAN_TIME} ~ '^[0-9]+:[0-9.]+$' THEN
      CAST(SPLIT_PART(${CLEAN_TIME}, ':', 1) AS DOUBLE PRECISION) * 60 +
      CAST(SPLIT_PART(${CLEAN_TIME}, ':', 2) AS DOUBLE PRECISION)
    WHEN ${CLEAN_TIME} ~ '^[0-9.]+$' THEN
      CAST(${CLEAN_TIME} AS DOUBLE PRECISION)
    ELSE NULL
  END
`;

const VALID_TIME_FILTER = `
  finals_time != '' AND finals_time IS NOT NULL
  AND time_standard NOT IN ('SCR', 'DQ', 'DNF', 'NS', '')
  AND stroke NOT LIKE '%Relay%'
  AND ${CLEAN_TIME} ~ '^[0-9]+([:.][0-9]+)*$'
`;

// --- Queries ---

export async function getCompetitions(): Promise<Competition[]> {
  const rows = await sql`
    SELECT DISTINCT competition_id as id, competition_name as name,
      MIN(date) as date, course,
      CASE
        WHEN LOWER(competition_name) LIKE '%open%' THEN 'open'
        WHEN LOWER(competition_name) LIKE '%championship%' THEN 'championship'
        WHEN LOWER(competition_name) LIKE '%time trial%' OR LOWER(competition_name) LIKE '%計時賽%' THEN 'timetrial'
        WHEN LOWER(competition_name) LIKE '%div.i %' OR LOWER(competition_name) LIKE '%第一組%' THEN 'div1'
        WHEN LOWER(competition_name) LIKE '%div.ii%' OR LOWER(competition_name) LIKE '%第二組%' THEN 'div2'
        WHEN LOWER(competition_name) LIKE '%div.iii%' OR LOWER(competition_name) LIKE '%第三組%' THEN 'div3'
        ELSE 'other'
      END as tier
    FROM results
    WHERE competition_id != ''
    GROUP BY competition_id, competition_name, course
    ORDER BY MIN(date) DESC
  `;
  return rows as Competition[];
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

export async function getSwimmer(id: string): Promise<Swimmer | undefined> {
  const rows = await sql`
    SELECT swimmer_id as id, swimmer_name as name, gender, club
    FROM results
    WHERE swimmer_id = ${id}
    ORDER BY date DESC
    LIMIT 1
  `;
  if (rows.length === 0) return undefined;
  const row = rows[0];

  const clubs = await sql`
    SELECT club, MIN(date) as first_seen, MAX(date) as last_seen
    FROM results
    WHERE swimmer_id = ${id} AND club != ''
    GROUP BY club
    ORDER BY MIN(date)
  `;

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
      ${sql.unsafe(TIME_TO_SECONDS)} as time_seconds,
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
      ${sql.unsafe(TIME_TO_SECONDS)} as time_seconds,
      date, age, competition_id
    FROM results
    WHERE swimmer_id = ${swimmerId}
      AND ${sql.unsafe(VALID_TIME_FILTER)}
      ${sql.unsafe(courseFilter)}
    ORDER BY distance, stroke, course, ${sql.unsafe(TIME_TO_SECONDS)} ASC
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

export async function getLeaderboard(
  eventKey: string,
  limit: number = 20
): Promise<PersonalBest[]> {
  const [stroke, distance, course] = eventKey.split("_");
  const rows = await sql`
    WITH best_times AS (
      SELECT DISTINCT ON (swimmer_id)
        swimmer_id, swimmer_name, club, distance, stroke, course,
        finals_time as time,
        ${sql.unsafe(TIME_TO_SECONDS)} as time_seconds,
        date, age, competition_id
      FROM results
      WHERE stroke = ${stroke} AND distance = ${distance} AND course = ${course}
        AND ${sql.unsafe(VALID_TIME_FILTER)}
      ORDER BY swimmer_id, ${sql.unsafe(TIME_TO_SECONDS)} ASC
    )
    SELECT * FROM best_times
    ORDER BY time_seconds
    LIMIT ${limit}
  `;
  return rows as PersonalBest[];
}

export async function getLeaderboardEventKeys(): Promise<string[]> {
  const rows = await sql`
    SELECT DISTINCT stroke || '_' || distance || '_' || course as event_key
    FROM results
    WHERE ${sql.unsafe(VALID_TIME_FILTER)}
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
}

export async function getClubs(): Promise<{ code: string; swimmer_count: number }[]> {
  const rows = await sql`
    SELECT club as code, COUNT(DISTINCT swimmer_id) as swimmer_count
    FROM results
    WHERE club != ''
    GROUP BY club
    ORDER BY club
  `;
  return rows as { code: string; swimmer_count: number }[];
}

export async function getClubSwimmers(
  clubCode: string
): Promise<{ id: string; name: string; gender: string }[]> {
  const rows = await sql`
    SELECT swimmer_id as id, swimmer_name as name, gender
    FROM results
    WHERE club = ${clubCode}
    GROUP BY swimmer_id, swimmer_name, gender
    ORDER BY swimmer_name
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
    SELECT swimmer_id as id, swimmer_name as name, club, gender,
      MAX(date) as last_date, COUNT(*) as result_count
    FROM results
    WHERE (${sql.unsafe(nameConditions)}) OR swimmer_id ILIKE ${pattern}
    GROUP BY swimmer_id, swimmer_name, club, gender
    ORDER BY MAX(date) DESC
    LIMIT ${limit}
  `;

  for (const s of swimmers) {
    results.push({
      type: "swimmer",
      id: s.id as string,
      name: s.name as string,
      subtitle: `${s.club} · ${s.gender} · ${s.result_count} results · last ${s.last_date}`,
    });
  }

  const clubs = await sql`
    SELECT club as code, COUNT(DISTINCT swimmer_id) as swimmer_count
    FROM results
    WHERE club ILIKE ${pattern}
    GROUP BY club
    ORDER BY COUNT(DISTINCT swimmer_id) DESC
    LIMIT 5
  `;

  for (const c of clubs) {
    results.push({
      type: "club",
      id: c.code as string,
      name: c.code as string,
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
    SELECT swimmer_id as id, swimmer_name as name, club
    FROM results
    WHERE (${sql.unsafe(nameConditions)}) OR swimmer_id ILIKE ${pattern}
    GROUP BY swimmer_id, swimmer_name, club
    ORDER BY MAX(date) DESC
    LIMIT ${limit}
  `;
  return rows as { id: string; name: string; club: string }[];
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
        ${sql.unsafe(TIME_TO_SECONDS)} as time_seconds
      FROM results
      WHERE swimmer_id = ${id1}
        AND ${sql.unsafe(VALID_TIME_FILTER)}
      ORDER BY distance, stroke, course, ${sql.unsafe(TIME_TO_SECONDS)} ASC
    ),
    pb2 AS (
      SELECT DISTINCT ON (distance, stroke, course)
        distance, stroke, course, finals_time as time,
        ${sql.unsafe(TIME_TO_SECONDS)} as time_seconds
      FROM results
      WHERE swimmer_id = ${id2}
        AND ${sql.unsafe(VALID_TIME_FILTER)}
      ORDER BY distance, stroke, course, ${sql.unsafe(TIME_TO_SECONDS)} ASC
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
    "finals_time != ''",
    "finals_time IS NOT NULL",
    "time_standard NOT IN ('SCR', 'DQ', 'DNF', 'NS', '')",
    "stroke NOT LIKE '%Relay%'",
    "date >= (CURRENT_DATE - INTERVAL '12 months')::TEXT",
  ];

  if (filters.stroke) conditions.push(`stroke = '${filters.stroke.replace(/'/g, "''")}'`);
  if (filters.course) conditions.push(`course = '${filters.course.replace(/'/g, "''")}'`);
  if (filters.gender === "Male") conditions.push("gender IN ('Men', 'Boys')");
  else if (filters.gender === "Female") conditions.push("gender IN ('Women', 'Girls')");
  if (filters.club) conditions.push(`club = '${filters.club.replace(/'/g, "''")}'`);

  conditions.push(`${CLEAN_TIME} ~ '^[0-9]+([:.][0-9]+)*$'`);
  const where = conditions.join(" AND ");

  const rows = await sql`${sql.unsafe(`
    WITH recent AS (
      SELECT swimmer_id, swimmer_name, club, distance, stroke, course, gender,
        finals_time, date,
        ${TIME_TO_SECONDS} as time_seconds
      FROM results
      WHERE ${where}
    ),
    earliest AS (
      SELECT swimmer_id, distance, stroke, course,
        finals_time as time, time_seconds, date,
        ROW_NUMBER() OVER (PARTITION BY swimmer_id, distance, stroke, course ORDER BY date ASC) as rn
      FROM recent
    ),
    latest AS (
      SELECT swimmer_id, distance, stroke, course,
        finals_time as time, time_seconds, date,
        ROW_NUMBER() OVER (PARTITION BY swimmer_id, distance, stroke, course ORDER BY date DESC) as rn
      FROM recent
    ),
    improvements AS (
      SELECT e.swimmer_id, e.distance, e.stroke, e.course,
        e.time as old_time, e.time_seconds as old_seconds, e.date as old_date,
        l.time as new_time, l.time_seconds as new_seconds, l.date as new_date,
        ROUND(((e.time_seconds - l.time_seconds) / e.time_seconds * 100)::NUMERIC, 2) as improvement_pct,
        (l.date::DATE - e.date::DATE) as days_between
      FROM earliest e
      JOIN latest l ON e.swimmer_id = l.swimmer_id
        AND e.distance = l.distance AND e.stroke = l.stroke AND e.course = l.course
      WHERE e.rn = 1 AND l.rn = 1
        AND l.time_seconds < e.time_seconds
        AND e.date != l.date
    )
    SELECT i.swimmer_id, r.swimmer_name, r.club,
      i.distance, i.stroke, i.course,
      i.old_time, i.old_seconds, i.new_time, i.new_seconds,
      i.improvement_pct, i.old_date, i.new_date, i.days_between
    FROM improvements i
    JOIN (SELECT swimmer_id, swimmer_name, club FROM results GROUP BY swimmer_id, swimmer_name, club) r
      ON i.swimmer_id = r.swimmer_id
    ORDER BY i.improvement_pct DESC
    LIMIT ${limit}
  `)}`;
  return rows as unknown as Improver[];
}

export async function getTrendFilterOptions(): Promise<{
  strokes: string[];
  courses: string[];
  genders: string[];
  clubs: string[];
}> {
  const [strokes, courses, clubs] = await Promise.all([
    sql`SELECT DISTINCT stroke FROM results WHERE stroke NOT LIKE '%Relay%' AND stroke != '' ORDER BY stroke`,
    sql`SELECT DISTINCT course FROM results WHERE course != '' ORDER BY course`,
    sql`SELECT club, COUNT(DISTINCT swimmer_id) as cnt FROM results WHERE club != '' GROUP BY club HAVING COUNT(DISTINCT swimmer_id) >= 5 ORDER BY club`,
  ]);

  return {
    strokes: strokes.map((r) => r.stroke as string),
    courses: courses.map((r) => r.course as string),
    genders: ["Male", "Female"],
    clubs: clubs.map((r) => r.club as string),
  };
}

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

export async function getBreakthroughSwims(limit: number = 20): Promise<Breakthrough[]> {
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
        AND stroke NOT LIKE '%Relay%'
    )
    SELECT swimmer_id, swimmer_name, club, distance, stroke, course,
      finals_time, time_standard, date, competition_name, age
    FROM standard_results
    WHERE rn = 1
    ORDER BY date DESC
    LIMIT ${limit}
  `;
  return rows as Breakthrough[];
}

// --- Stats ---

export interface DbStats {
  total_results: number;
  total_swimmers: number;
  total_clubs: number;
  total_competitions: number;
  date_from: string;
  date_to: string;
}

export async function getDbStats(): Promise<DbStats> {
  const rows = await sql`
    SELECT
      COUNT(*) as total_results,
      COUNT(DISTINCT swimmer_id) as total_swimmers,
      COUNT(DISTINCT club) as total_clubs,
      COUNT(DISTINCT competition_id) as total_competitions,
      MIN(date) as date_from,
      MAX(date) as date_to
    FROM results
    WHERE swimmer_id != ''
  `;
  return rows[0] as DbStats;
}

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
        AND stroke NOT LIKE '%Relay%'
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
