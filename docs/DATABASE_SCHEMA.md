# Database Schema (Neon PostgreSQL)

The production database runs on [Neon](https://neon.tech) serverless PostgreSQL, connected via `@neondatabase/serverless`. The local development database is SQLite (`swimming.db`) with an identical `results` schema.

## Tables

### `results`

The core table storing all swimming competition results. Denormalized — each row is a single swimmer's result in a single event.

```sql
CREATE TABLE results (
    id              SERIAL PRIMARY KEY,
    competition_id  TEXT    NOT NULL DEFAULT '',
    competition_name TEXT   NOT NULL DEFAULT '',
    date            TEXT    NOT NULL DEFAULT '',
    event_num       INTEGER NOT NULL DEFAULT 0,
    gender          TEXT    NOT NULL DEFAULT '',
    age_group       TEXT    NOT NULL DEFAULT '',
    distance        TEXT    NOT NULL DEFAULT '',
    course          TEXT    NOT NULL DEFAULT '',
    stroke          TEXT    NOT NULL DEFAULT '',
    place           INTEGER,
    swimmer_id      TEXT    NOT NULL DEFAULT '',
    swimmer_name    TEXT    NOT NULL DEFAULT '',
    age             INTEGER,
    club            TEXT    NOT NULL DEFAULT '',
    seed_time       TEXT    NOT NULL DEFAULT '',
    finals_time     TEXT    NOT NULL DEFAULT '',
    time_standard   TEXT    NOT NULL DEFAULT '',
    splits          TEXT    NOT NULL DEFAULT ''
);
```

#### Column Reference

| Column | Type | Nullable | Description | Example Values |
|--------|------|----------|-------------|----------------|
| `id` | SERIAL | No | Auto-incrementing PK | `1`, `2`, `342327` |
| `competition_id` | TEXT | No | Source competition identifier | `"2394_1"`, `"16_event_123"` |
| `competition_name` | TEXT | No | Full competition name | `"The 1st Long Course Swimming Competition 2024-2025"` |
| `date` | TEXT | No | ISO date (YYYY-MM-DD) | `"2026-03-16"` |
| `event_num` | INTEGER | No | Event number within competition | `1`, `39` |
| `gender` | TEXT | No | Gender category from event header | `"Men"`, `"Women"`, `"Boys"`, `"Girls"` |
| `age_group` | TEXT | No | Age group from event header | `"Open"`, `"13 & 14 YRS"`, `"10 & Under"` |
| `distance` | TEXT | No | Race distance in meters | `"50"`, `"100"`, `"200"`, `"1500"` |
| `course` | TEXT | No | Pool length | `"LC"` (50m), `"SC"` (25m) |
| `stroke` | TEXT | No | Stroke/discipline | `"Freestyle"`, `"Backstroke"`, `"Breaststroke"`, `"Butterfly"`, `"IM"` |
| `place` | INTEGER | Yes | Finishing position (NULL if DNS/DQ/SCR) | `1`, `2`, `NULL` |
| `swimmer_id` | TEXT | No | HK Swimming registration number (numeric only) | `"30192"`, `"48574"` |
| `swimmer_name` | TEXT | No | Full name (English) | `"Chan Hoi Man"`, `"Whittington, Peter"` |
| `age` | INTEGER | Yes | Age at time of competition | `12`, `17`, `NULL` |
| `club` | TEXT | No | Club code (typically 3 letters) | `"HTA"`, `"WTS"`, `"SCA"`, `"DLS"` |
| `seed_time` | TEXT | No | Entry/seed time | `"1:23.45"`, `"NT"`, `""` |
| `finals_time` | TEXT | No | Race time | `"1:23.45"`, `"55.80"`, `"17:13.41"` |
| `time_standard` | TEXT | No | Qualifying standard or status code | `"D1"`, `"QT"`, `"AQT"`, `"SCR"`, `"DQ"`, `"DNF"`, `""` |
| `splits` | TEXT | No | Split times (if recorded) | `"27.50, 58.30, 1:30.12, 2:01.45"` |

#### Indexes

```sql
CREATE INDEX idx_results_swimmer_id     ON results(swimmer_id);
CREATE INDEX idx_results_swimmer_name   ON results(swimmer_name);
CREATE INDEX idx_results_club           ON results(club);
CREATE INDEX idx_results_competition_id ON results(competition_id);
CREATE INDEX idx_results_date           ON results(date);
CREATE INDEX idx_results_event          ON results(distance, stroke, course, gender);
```

#### Special Values

**`time_standard` codes:**

| Code | Meaning |
|------|---------|
| `D1` | Division 1 standard |
| `D2` | Division 2 standard |
| `QT` | Qualifying Time |
| `AQT` | Automatic Qualifying Time |
| `A`, `B` | Performance level standards |
| `J` | Junior standard |
| `H` | Hong Kong record |
| `SCR` | Scratched (did not start) |
| `DQ` | Disqualified |
| `DNF` | Did not finish |
| `NS` | No show |

**Valid result filtering** (used across queries):

```sql
WHERE finals_time IS NOT NULL
  AND finals_time != ''
  AND time_standard NOT IN ('SCR', 'DQ', 'DNF', 'NS', '')
  AND stroke NOT LIKE '%Relay%'
  AND REGEXP_REPLACE(finals_time, '[^0-9:.]', '', 'g') ~ '^[0-9]+[:.][0-9]'
```

---

### `feedback`

User-submitted feedback for the platform.

```sql
CREATE TABLE IF NOT EXISTS feedback (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100)                NOT NULL DEFAULT 'Anonymous',
    category    VARCHAR(20)                 NOT NULL DEFAULT 'feedback',
    title       VARCHAR(200)                NOT NULL,
    description TEXT                        NOT NULL,
    status      VARCHAR(20)                 NOT NULL DEFAULT 'open',
    created_at  TIMESTAMP WITH TIME ZONE    DEFAULT NOW()
);
```

#### Column Reference

| Column | Type | Description | Example Values |
|--------|------|-------------|----------------|
| `id` | SERIAL | Auto-incrementing PK | `1`, `2` |
| `name` | VARCHAR(100) | Submitter name | `"Anonymous"`, `"Coach Lee"` |
| `category` | VARCHAR(20) | Feedback type | `"bug"`, `"feature"`, `"suggestion"`, `"feedback"` |
| `title` | VARCHAR(200) | Brief title | `"Missing results from March comp"` |
| `description` | TEXT | Full description | Free text |
| `status` | VARCHAR(20) | Current status | `"open"`, `"in-progress"`, `"closed"` |
| `created_at` | TIMESTAMPTZ | Submission time | Auto-set via `NOW()` |

#### Indexes

```sql
CREATE INDEX idx_feedback_status  ON feedback(status);
CREATE INDEX idx_feedback_created ON feedback(created_at DESC);
```

---

## Time Conversion Logic

Times are stored as text strings and converted to seconds in SQL for sorting and comparison:

```sql
CASE
    -- HH:MM:SS.ss format
    WHEN clean_time ~ '^[0-9]+:[0-9]+:[0-9.]+$' THEN
        SPLIT_PART(clean_time, ':', 1)::NUMERIC * 3600
      + SPLIT_PART(clean_time, ':', 2)::NUMERIC * 60
      + SPLIT_PART(clean_time, ':', 3)::NUMERIC

    -- MM:SS.ss format
    WHEN clean_time ~ '^[0-9]+:[0-9.]+$' THEN
        SPLIT_PART(clean_time, ':', 1)::NUMERIC * 60
      + SPLIT_PART(clean_time, ':', 2)::NUMERIC

    -- SS.ss format (seconds only)
    WHEN clean_time ~ '^[0-9.]+$' THEN
        clean_time::NUMERIC

    ELSE NULL
END
```

Where `clean_time` is pre-processed:
```sql
REGEXP_REPLACE(finals_time, '[^0-9:.]', '', 'g') AS clean_time
```

---

## Common Query Patterns

### Personal Bests

Uses `DISTINCT ON` to get the fastest time per swimmer per event:

```sql
SELECT DISTINCT ON (swimmer_id, distance, stroke, course)
    swimmer_id, swimmer_name, distance, stroke, course,
    finals_time, date, competition_name
FROM results
WHERE /* valid result filters */
ORDER BY swimmer_id, distance, stroke, course, time_seconds ASC
```

### Leaderboards

Ranks swimmers by fastest time in a specific event:

```sql
SELECT *, ROW_NUMBER() OVER (ORDER BY time_seconds ASC) AS rank
FROM (
    SELECT DISTINCT ON (swimmer_id)
        swimmer_id, swimmer_name, club, finals_time, date
    FROM results
    WHERE distance = $1 AND stroke = $2 AND course = $3 AND gender = $4
      AND /* valid result filters */
    ORDER BY swimmer_id, time_seconds ASC
) bests
ORDER BY time_seconds ASC
```

### Biggest Improvers

Uses window functions to compare a swimmer's earliest and latest times:

```sql
WITH ranked AS (
    SELECT *,
        ROW_NUMBER() OVER (PARTITION BY swimmer_id ORDER BY date ASC)  AS rn_first,
        ROW_NUMBER() OVER (PARTITION BY swimmer_id ORDER BY date DESC) AS rn_last
    FROM results
    WHERE /* valid result filters + date range */
)
SELECT first.swimmer_id,
       first.time_seconds - last.time_seconds AS improvement
FROM ranked first
JOIN ranked last ON first.swimmer_id = last.swimmer_id
WHERE first.rn_first = 1 AND last.rn_last = 1
```

---

## Migration

### SQLite → Neon Postgres

`migrate_to_pg.py` handles the full migration:

1. Reads all rows from `swimming.db`
2. Drops and recreates `results` table in Postgres
3. Batch inserts in 5,000-row chunks
4. Recreates all indexes
5. Verifies row counts match

```bash
# Requires DATABASE_URL environment variable
python migrate_to_pg.py
```

### Feedback Table

`migrate_feedback.py` creates the feedback table separately (uses `IF NOT EXISTS`).

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Denormalized single table | Simplifies queries; no JOINs needed. Competition/swimmer data is always accessed together with results. |
| Times stored as TEXT | Swimming times have varied formats (SS.ss, MM:SS.ss, HH:MM:SS.ss). Text preserves original formatting; conversion to seconds happens in SQL when needed. |
| Dates stored as TEXT | ISO format sorts correctly as text. Avoids timezone issues. |
| swimmer_id as TEXT | Registration IDs are numeric but not used for arithmetic. Some legacy IDs had letter suffixes. |
| No foreign keys | Single-table design. Referential integrity is maintained by the pipeline (same data source). |
| Idempotent migration | `migrate_to_pg.py` drops and recreates. Safe to re-run after any data refresh. |
