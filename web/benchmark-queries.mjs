import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local
const envPath = resolve(import.meta.dirname, ".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
}

const sql = neon(process.env.DATABASE_URL);

const VALID_TIME_FILTER = `time_seconds IS NOT NULL AND time_standard NOT IN ('SCR', 'DQ', 'DNF', 'NS') AND stroke != 'Freestyle Relay'`;

const results = [];

async function bench(name, fn) {
  const start = performance.now();
  try {
    const res = await fn();
    const ms = performance.now() - start;
    const rowCount = Array.isArray(res) ? res.length : 1;
    results.push({ name, ms: ms.toFixed(1), rows: rowCount, status: "OK" });
    console.log(`  ✓ ${name}: ${ms.toFixed(1)}ms (${rowCount} rows)`);
  } catch (err) {
    const ms = performance.now() - start;
    results.push({ name, ms: ms.toFixed(1), rows: 0, status: `ERROR: ${err.message}` });
    console.log(`  ✗ ${name}: ${ms.toFixed(1)}ms - ERROR: ${err.message}`);
  }
}

// First, get some sample IDs to use in parameterized queries
console.log("Fetching sample data for parameterized queries...\n");
const sampleSwimmer = await sql`SELECT swimmer_id FROM results WHERE swimmer_id != '' LIMIT 1`;
const swimmerId = sampleSwimmer[0]?.swimmer_id || "UNKNOWN";

const sampleComp = await sql`SELECT competition_id FROM results WHERE competition_id != '' LIMIT 1`;
const competitionId = sampleComp[0]?.competition_id || "UNKNOWN";

const sampleEvent = await sql`SELECT event_num FROM results WHERE competition_id = ${competitionId} LIMIT 1`;
const eventNum = sampleEvent[0]?.event_num || 1;

const sampleClub = await sql`SELECT club FROM results WHERE club != '' LIMIT 1`;
const clubCode = sampleClub[0]?.club || "UNKNOWN";

// Get a second swimmer for head-to-head
const sampleSwimmer2 = await sql`SELECT swimmer_id FROM results WHERE swimmer_id != '' AND swimmer_id != ${swimmerId} LIMIT 1`;
const swimmerId2 = sampleSwimmer2[0]?.swimmer_id || "UNKNOWN";

console.log(`Sample swimmer: ${swimmerId}`);
console.log(`Sample swimmer2: ${swimmerId2}`);
console.log(`Sample competition: ${competitionId}`);
console.log(`Sample event_num: ${eventNum}`);
console.log(`Sample club: ${clubCode}\n`);

console.log("--- Running benchmarks ---\n");

// 1. getCompetitions
await bench("getCompetitions", () => sql`
  SELECT competition_id as id, competition_name as name,
    MIN(date) as date, course
  FROM results
  WHERE competition_id != ''
  GROUP BY competition_id, competition_name, course
  ORDER BY MIN(date) DESC
`);

// 2. getCompetitionEvents
await bench("getCompetitionEvents", () => sql`
  SELECT DISTINCT event_num, gender, age_group, distance, stroke, course
  FROM results
  WHERE competition_id = ${competitionId}
  ORDER BY event_num
`);

// 3. getCompetitionResults
await bench("getCompetitionResults", () => sql`
  SELECT * FROM results
  WHERE competition_id = ${competitionId}
  ORDER BY event_num,
    CASE WHEN place IS NULL THEN 1 ELSE 0 END,
    place
`);

// 4. getCompetitionResultsByEvent
await bench("getCompetitionResultsByEvent", () => sql`
  SELECT * FROM results
  WHERE competition_id = ${competitionId}
    AND event_num = ${eventNum}
  ORDER BY
    CASE WHEN place IS NULL THEN 1 ELSE 0 END,
    place
`);

// 5. getCompetitionResultsBySwimmer
await bench("getCompetitionResultsBySwimmer", () => sql`
  SELECT * FROM results
  WHERE competition_id = ${competitionId}
    AND REPLACE(swimmer_name, ',', '') ILIKE ${'%test%'}
  ORDER BY event_num,
    CASE WHEN place IS NULL THEN 1 ELSE 0 END,
    place
`);

// 6. getSwimmer (two queries in parallel)
await bench("getSwimmer", async () => {
  const [rows, clubs] = await Promise.all([
    sql`
      SELECT swimmer_id as id, swimmer_name as name, gender, club
      FROM results
      WHERE swimmer_id = ${swimmerId}
      ORDER BY date DESC
      LIMIT 1
    `,
    sql`
      SELECT club, MIN(date) as first_seen, MAX(date) as last_seen
      FROM results
      WHERE swimmer_id = ${swimmerId} AND club != ''
      GROUP BY club
      ORDER BY MIN(date)
    `,
  ]);
  return rows;
});

// 7. getSwimmerResults
await bench("getSwimmerResults", () => sql`
  SELECT * FROM results
  WHERE swimmer_id = ${swimmerId}
  ORDER BY date DESC, event_num
`);

// 8. getSwimmerCompetitions
await bench("getSwimmerCompetitions", () => sql`
  SELECT DISTINCT competition_id as id, competition_name as name,
    MIN(date) as date, course
  FROM results
  WHERE swimmer_id = ${swimmerId} AND competition_id != ''
  GROUP BY competition_id, competition_name, course
  ORDER BY MIN(date) DESC
`);

// 9. getSwimmerResultsInCompetition
await bench("getSwimmerResultsInCompetition", () => sql`
  SELECT * FROM results
  WHERE swimmer_id = ${swimmerId} AND competition_id = ${competitionId}
  ORDER BY event_num
`);

// 10. getSwimmerTimeHistory
await bench("getSwimmerTimeHistory", () => sql`
  SELECT date, finals_time as time,
    time_seconds,
    distance || 'm ' || stroke || ' ' || course as event_label,
    competition_name
  FROM results
  WHERE swimmer_id = ${swimmerId}
    AND ${sql.unsafe(VALID_TIME_FILTER)}
  ORDER BY date
`);

// 11. getSwimmerPersonalBests
await bench("getSwimmerPersonalBests", () => sql`
  SELECT DISTINCT ON (distance, stroke, course)
    swimmer_id, swimmer_name, club, distance, stroke, course,
    finals_time as time,
    time_seconds,
    date, age, competition_id, competition_name, place
  FROM results
  WHERE swimmer_id = ${swimmerId}
    AND ${sql.unsafe(VALID_TIME_FILTER)}
  ORDER BY distance, stroke, course, time_seconds ASC
`);

// 12. getSwimmerStats
await bench("getSwimmerStats", () => sql`
  SELECT
    COUNT(DISTINCT competition_id) as competition_count,
    COUNT(*) as result_count,
    MIN(date) as first_competed,
    MAX(date) as last_competed
  FROM results
  WHERE swimmer_id = ${swimmerId}
`);

// 13. getLeaderboardEventKeys
await bench("getLeaderboardEventKeys", () => sql`
  SELECT DISTINCT stroke || '_' || distance || '_' || course as event_key
  FROM results
  WHERE time_seconds IS NOT NULL
  ORDER BY event_key
`);

// 14. getLeaderboard (Freestyle_50_SC as sample)
await bench("getLeaderboard(Freestyle_50_SC)", () => sql`${sql.unsafe(`
  WITH best_times AS (
    SELECT DISTINCT ON (swimmer_id)
      swimmer_id, swimmer_name, club, distance, stroke, course,
      finals_time as time,
      time_seconds,
      date, age, competition_id
    FROM results
    WHERE stroke = 'Freestyle' AND distance = '50' AND course = 'SC'
      AND ${VALID_TIME_FILTER}
    ORDER BY swimmer_id, time_seconds ASC
  )
  SELECT * FROM best_times
  ORDER BY time_seconds
  LIMIT 20
`)}`);

// 15. getLeaderboard with gender filter
await bench("getLeaderboard(Freestyle_100_LC,Male)", () => sql`${sql.unsafe(`
  WITH best_times AS (
    SELECT DISTINCT ON (swimmer_id)
      swimmer_id, swimmer_name, club, distance, stroke, course,
      finals_time as time,
      time_seconds,
      date, age, competition_id
    FROM results
    WHERE stroke = 'Freestyle' AND distance = '100' AND course = 'LC'
      AND gender IN ('Men', 'Boys')
      AND ${VALID_TIME_FILTER}
    ORDER BY swimmer_id, time_seconds ASC
  )
  SELECT * FROM best_times
  ORDER BY time_seconds
  LIMIT 20
`)}`);

// 16. getLeaderboardFilterOptions (age_group query)
await bench("getLeaderboardFilterOptions(ageGroups)", () => sql`
  SELECT DISTINCT age_group FROM results WHERE age_group != '' AND stroke != 'Freestyle Relay' ORDER BY age_group
`);

// 17. getClubs
await bench("getClubs", () => sql`
  SELECT club as code, COUNT(DISTINCT swimmer_id) as swimmer_count
  FROM results
  WHERE club != ''
  GROUP BY club
  ORDER BY club
`);

// 18. getClubSwimmers
await bench("getClubSwimmers", () => sql`
  SELECT id, name, gender FROM (
    SELECT DISTINCT ON (swimmer_id)
      swimmer_id as id, swimmer_name as name, gender, date
    FROM results
    WHERE club = ${clubCode}
    ORDER BY swimmer_id, date DESC
  ) sub
  ORDER BY name
`);

// 19. search (swimmers)
await bench("search(swimmers)", () => sql`
  SELECT DISTINCT ON (swimmer_id)
    swimmer_id as id, swimmer_name as name, club, gender,
    MAX(date) OVER (PARTITION BY swimmer_id) as last_date,
    COUNT(*) OVER (PARTITION BY swimmer_id) as result_count
  FROM results
  WHERE (REPLACE(swimmer_name, ',', '') ILIKE '%chan%') OR swimmer_id ILIKE '%chan%'
  ORDER BY swimmer_id, date DESC
`);

// 20. search (clubs)
await bench("search(clubs)", () => sql`${sql.unsafe(`
  SELECT club as code, COUNT(DISTINCT swimmer_id) as swimmer_count
  FROM results
  WHERE club ILIKE 'SC%' OR club IN ('SCP','SCAA')
  GROUP BY club
  ORDER BY COUNT(DISTINCT swimmer_id) DESC
  LIMIT 5
`)}`);

// 21. search (competitions)
await bench("search(competitions)", () => sql`
  SELECT DISTINCT competition_id as id, competition_name as name,
    MIN(date) as date, course
  FROM results
  WHERE competition_name ILIKE ${'%championship%'} OR competition_id ILIKE ${'%championship%'}
  GROUP BY competition_id, competition_name, course
  ORDER BY MIN(date) DESC
  LIMIT 5
`);

// 22. getHeadToHead
await bench("getHeadToHead", () => sql`
  WITH pb1 AS (
    SELECT DISTINCT ON (distance, stroke, course)
      distance, stroke, course, finals_time as time,
      time_seconds
    FROM results
    WHERE swimmer_id = ${swimmerId}
      AND time_seconds IS NOT NULL
    ORDER BY distance, stroke, course, time_seconds ASC
  ),
  pb2 AS (
    SELECT DISTINCT ON (distance, stroke, course)
      distance, stroke, course, finals_time as time,
      time_seconds
    FROM results
    WHERE swimmer_id = ${swimmerId2}
      AND time_seconds IS NOT NULL
    ORDER BY distance, stroke, course, time_seconds ASC
  )
  SELECT pb1.distance, pb1.stroke, pb1.course,
    pb1.time as swimmer1_time, pb1.time_seconds as swimmer1_seconds,
    pb2.time as swimmer2_time, pb2.time_seconds as swimmer2_seconds
  FROM pb1
  INNER JOIN pb2 ON pb1.distance = pb2.distance AND pb1.stroke = pb2.stroke AND pb1.course = pb2.course
  ORDER BY CAST(pb1.distance AS INTEGER), pb1.stroke, pb1.course
`);

// 23. getBiggestImprovers
await bench("getBiggestImprovers", () => sql`${sql.unsafe(`
  WITH recent AS (
    SELECT swimmer_id, swimmer_name, club, distance, stroke, course,
      finals_time, date, time_seconds,
      ROW_NUMBER() OVER (PARTITION BY swimmer_id, distance, stroke, course ORDER BY date ASC) as rn_earliest,
      ROW_NUMBER() OVER (PARTITION BY swimmer_id, distance, stroke, course ORDER BY date DESC) as rn_latest
    FROM results
    WHERE time_seconds IS NOT NULL
      AND date >= (CURRENT_DATE - INTERVAL '12 months')::TEXT
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
  LIMIT 25
`)}`);

// 24. getTrendFilterOptions (strokes, courses, clubs)
await bench("getTrendFilterOptions", async () => {
  const [strokes, courses, clubs] = await Promise.all([
    sql`SELECT DISTINCT stroke FROM results WHERE stroke != 'Freestyle Relay' AND stroke != '' ORDER BY stroke`,
    sql`SELECT DISTINCT course FROM results WHERE course != '' ORDER BY course`,
    sql`SELECT club, COUNT(DISTINCT swimmer_id) as cnt FROM results WHERE club != '' GROUP BY club HAVING COUNT(DISTINCT swimmer_id) >= 5 ORDER BY club`,
  ]);
  return [...strokes, ...courses, ...clubs];
});

// 25. getBreakthroughSwims
await bench("getBreakthroughSwims", () => sql`
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
  LIMIT 20
`);

// 26. getDbStats
await bench("getDbStats", () => sql`
  SELECT
    COUNT(*) as total_results,
    COUNT(DISTINCT swimmer_id) as total_swimmers,
    COUNT(DISTINCT club) as total_clubs,
    COUNT(DISTINCT competition_id) as total_competitions,
    MIN(date) as date_from,
    MAX(date) as date_to
  FROM results
  WHERE swimmer_id != ''
`);

// 27. getClubAnalytics (3 parallel queries)
await bench("getClubAnalytics", async () => {
  const [seasonStats, strokeStrength, totals] = await Promise.all([
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
  return [...seasonStats, ...strokeStrength, ...totals];
});

// 28. getFeedback
await bench("getFeedback", () => sql`
  SELECT id, name, category, title, description, status, created_at::TEXT
  FROM feedback
  ORDER BY created_at DESC
`);

// 29. getAppeals
await bench("getAppeals", () => sql`
  SELECT id, appeal_type, submitter_name, submitter_email, swimmer_name, swimmer_id,
    competition_name, event_description, recorded_time, reason,
    requested_change, status, admin_note, created_at::TEXT, reviewed_at::TEXT
  FROM appeals
  ORDER BY created_at DESC
`);

// 30. getTeam
await bench("getTeam", () => sql`
  SELECT code, name, swimmer_ids, created_at, updated_at
  FROM teams WHERE code = ${'test-team'}
`);

// 31. searchSwimmers
await bench("searchSwimmers", () => sql`
  SELECT DISTINCT ON (swimmer_id)
    swimmer_id as id, swimmer_name as name, club,
    MAX(date) OVER (PARTITION BY swimmer_id) as last_date
  FROM results
  WHERE (REPLACE(swimmer_name, ',', '') ILIKE '%wong%') OR swimmer_id ILIKE '%wong%'
  ORDER BY swimmer_id, date DESC
`);

// Print summary
console.log("\n\n=== BENCHMARK SUMMARY ===\n");
console.log("Query".padEnd(45) + "Time(ms)".padStart(10) + "  Rows".padStart(8) + "  Status");
console.log("-".repeat(75));

let totalMs = 0;
for (const r of results) {
  totalMs += parseFloat(r.ms);
  console.log(
    r.name.padEnd(45) +
    r.ms.padStart(10) +
    String(r.rows).padStart(8) +
    "  " + r.status
  );
}
console.log("-".repeat(75));
console.log(`TOTAL: ${totalMs.toFixed(1)}ms across ${results.length} queries`);

// Sort by time descending
console.log("\n\n=== SLOWEST QUERIES ===\n");
const sorted = [...results].sort((a, b) => parseFloat(b.ms) - parseFloat(a.ms));
for (const r of sorted.slice(0, 10)) {
  console.log(`  ${r.ms.padStart(8)}ms  ${r.name}`);
}
