# Data Pipeline

How competition results flow from source PDFs into the production database.

## Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                                 │
│                                                                     │
│  hkgswimming.org.hk                                                │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ Local Competitions│  │ Masters Results  │  │ Club Directory   │  │
│  │ (activities/16)   │  │ (LCM/SCM)       │  │ (annual PDFs)    │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
│           │                     │                      │            │
│  ┌────────┴─────────┐  ┌───────┴──────────┐  ┌───────┴──────────┐ │
│  │ Future Sources    │  │ Inter-School     │  │ Inter-Varsity    │ │
│  │ (planned)         │  │ (planned)        │  │ (planned)        │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     1. SCRAPING LAYER                               │
│                                                                     │
│  scrape_results.py          scrape_masters.py     download_clubs.py │
│  ─────────────────          ─────────────────     ──────────────── │
│  • Paginated event lists    • 3 categories:       • Annual club     │
│  • Filters result PDFs        LCM Champs,           directory PDFs  │
│  • Rate-limited downloads     LCM, SCM            • 11 years of    │
│  • Deduplication by ID      • Season sub-pages      history         │
│                                                                     │
│  Output: data/pdf/local_competition/*.pdf                           │
│          data/pdf/masters/*.pdf                                     │
│          data/pdf/clubs/*.pdf                                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     2. PARSING LAYER                                │
│                                                                     │
│  parse_results.py (HY-TEK Meet Manager PDF parser)                 │
│  ─────────────────                                                  │
│  • Uses pdfplumber for text extraction                              │
│  • Supports HY-TEK versions 5.0–8.0                                │
│  • Extracts per result row:                                         │
│    place, swimmer_id, name, age, club,                              │
│    seed_time, finals_time, time_standard, splits                    │
│  • Handles: DQ, DNF, SCR, NS, tied places, relay events            │
│  • Date normalization (DD/MM/YYYY → YYYY-MM-DD)                    │
│                                                                     │
│  Output: data/csv/local_competition/*.csv (one per PDF)             │
│          data/csv/masters/*.csv                                     │
│                                                                     │
│  CSV columns:                                                       │
│    competition_id, competition_name, date, event_num, gender,       │
│    age_group, distance, course, stroke, place, swimmer_id,          │
│    swimmer_name, age, club, seed_time, finals_time,                 │
│    time_standard, splits                                            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     3. DATABASE BUILD                               │
│                                                                     │
│  build_db.py                                                        │
│  ───────────                                                        │
│  • Reads all CSVs from data/csv/                                    │
│  • Normalizes swimmer IDs (strips suffix letters)                   │
│  • Parses place, age, event_num as integers                         │
│  • Batch inserts into SQLite                                        │
│  • Creates 6 performance indexes                                    │
│                                                                     │
│  Output: swimming.db (SQLite, ~98 MB)                               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     4. DATA CLEANING                                │
│                                                                     │
│  fix_data.py + clean_db.py (idempotent, safe to re-run)            │
│  ──────────────────────────                                         │
│  • Date normalization (M/D/YYYY → YYYY-MM-DD)                      │
│  • Extract dates from competition names when missing                │
│  • Strip X-prefix from exhibition swims                             │
│  • Fix QT misplaced as finals_time                                  │
│  • Delete garbled/OCR artifacts                                     │
│  • Split glued time+standard pairs (e.g., "1:00.00qQT")            │
│  • Normalize swimmer names (longest variant per ID)                 │
│  • Strip '#' from swimmer_id (PDF artifact)                         │
│  • Strip trailing letters from finals_time ("55.80S" → "55.80")    │
│                                                                     │
│  Output: swimming.db (cleaned in-place)                             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     5. PRODUCTION DEPLOYMENT                        │
│                                                                     │
│  migrate_to_pg.py                                                   │
│  ────────────────                                                   │
│  • Reads all rows from SQLite                                       │
│  • Drops and recreates `results` table in Neon Postgres             │
│  • Batch inserts in 5,000-row chunks                                │
│  • Recreates all 6 indexes                                          │
│  • Verifies row counts match                                        │
│  • Idempotent (safe to re-run)                                      │
│                                                                     │
│  Output: Neon PostgreSQL (via DATABASE_URL)                         │
│                                                                     │
│  migrate_feedback.py                                                │
│  ───────────────────                                                │
│  • Creates feedback table (if not exists)                           │
│  • Separate from results pipeline                                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     6. WEB APPLICATION                              │
│                                                                     │
│  Next.js app (web/src/lib/db.ts)                                   │
│  ────────────────────────────────                                   │
│  • Queries Neon Postgres via @neondatabase/serverless               │
│  • Server-side rendering with SQL queries                           │
│  • Personal bests computed via DISTINCT ON + window functions       │
│  • Time parsing in SQL (MM:SS.ss → seconds)                        │
│  • Deployed on Vercel                                               │
└─────────────────────────────────────────────────────────────────────┘
```

## Running the Pipeline

```bash
# 1. Scrape new PDFs
python scrape_results.py          # local competitions
python scrape_masters.py          # masters competitions
python download_clubs.py          # club directory

# 2. Parse PDFs to CSV
python parse_results.py           # all PDFs → CSV

# 3. Build SQLite database
python build_db.py                # CSV → swimming.db

# 4. Clean data
python fix_data.py                # normalize dates, names, times
python clean_db.py                # strip artifacts

# 5. Deploy to production
python migrate_to_pg.py           # SQLite → Neon Postgres
```

## Adding New Data Sources

When adding a new competition type (e.g., inter-school, inter-varsity):

1. **Create a new scraper** (e.g., `scrape_interschool.py`)
   - Identify the source URL on hkgswimming.org.hk or other sites
   - Download PDFs to `data/pdf/<source_name>/`
   - Follow rate-limiting conventions (0.3–0.5s between requests)

2. **Verify PDF format compatibility**
   - If the PDFs use HY-TEK Meet Manager format, `parse_results.py` should work as-is
   - If the format differs, extend the parser or create a new one
   - Output CSVs to `data/csv/<source_name>/` with the same column schema

3. **Update `build_db.py`**
   - Add the new CSV directory to the list of input paths
   - Ensure competition_id values don't collide with existing sources

4. **Run cleaning + migration**
   - `fix_data.py` and `clean_db.py` should handle new data automatically
   - `migrate_to_pg.py` replaces the full table, so new data is included

5. **Update competition tier detection** in `build_data.py` and/or `web/src/lib/db.ts`
   - Add new tier keywords (e.g., "inter-school", "inter-varsity")
   - Update any filters or UI labels

## Data Quality Checks

| Check | Status |
|-------|--------|
| Zero empty dates | ✅ |
| Zero bad date formats | ✅ |
| Zero non-numeric swimmer IDs | ✅ |
| Normalized swimmer names | ✅ |
| Clean finals_time values | ✅ |

## Current Scale

- **342,327** total results
- **14,897** unique swimmers
- **218** competitions (2014–2026)
- **90+** clubs
- **~282** source PDFs
