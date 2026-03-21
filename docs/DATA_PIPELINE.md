# Data Pipeline

How competition results flow from source PDFs into the production database.

## Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                                 │
│                                                                     │
│  hkgswimming.org.hk                    hkssf-ext.org.hk             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ Local Competitions│  │ Masters Results  │  │ Club Directory   │  │
│  │ (activities/16)   │  │ (LCM/SCM)       │  │ (annual PDFs)    │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
│           │                     │                      │            │
│  ┌────────┴─────────┐  ┌───────┴──────────┐  ┌───────┴──────────┐ │
│  │ HKSSF Secondary   │  │ Regional (LCSD) │  │ Open Water       │ │
│  │ Inter-School Comps │  │                 │  │                  │ │
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
│  scrape_hkssf_secondary.py  scrape_regional.py    scrape_openwater.py│
│  ─────────────────────────  ──────────────────    ─────────────────  │
│  • HKSSF inter-school PDFs  • 18 LCSD districts  • Open water PDFs │
│  • Div 1/2/3, 9 seasons     • Age-group results  • 1500m–10km      │
│  • hkssf-ext.org.hk         • lcsd.gov.hk        • hkgswimming.org │
│                                                                     │
│  Output: data/pdf/local_competition/*.pdf                           │
│          data/pdf/masters/*.pdf                                     │
│          data/pdf/clubs/*.pdf                                       │
│          data/pdf/hkssf_secondary/*.pdf                             │
│          data/pdf/regional/*.pdf                                    │
│          data/pdf/openwater/*.pdf                                   │
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
│  parse_hkssf_secondary.py (HKSSF inter-school parser)              │
│  ────────────────────────                                           │
│  • Handles 3 PDF formats across seasons 1516–2425                  │
│    - Old heat-by-heat text format (1516–1920)                      │
│    - Tabular finals-only (2122)                                     │
│    - Tabular with all heats (2223–2425)                            │
│  • Extracts: rank, name, school, time, grade, division, region     │
│  • No swimmer IDs (school competitions lack HKASA registration)    │
│  • Additional columns: season, division, region, heat, points,     │
│    record                                                           │
│  • Outputs to separate hkssf_results table (not merged with        │
│    main results)                                                    │
│                                                                     │
│  parse_regional.py / parse_openwater.py                            │
│  ──────────────────────────────────────                             │
│  • LCSD district and open water parsers                            │
│  • Output same 19-column CSV schema as parse_results.py            │
│                                                                     │
│  Output: data/csv/local_competition/*.csv (one per PDF)             │
│          data/csv/masters/*.csv                                     │
│          data/csv/regional/*.csv                                    │
│          data/csv/hkssf_secondary/*.csv                             │
│                                                                     │
│  Main CSV columns (19):                                             │
│    competition_id, competition_name, date, event_num, gender,       │
│    age_group, distance, course, stroke, place, swimmer_id,          │
│    swimmer_name, age, club, seed_time, finals_time,                 │
│    time_standard, splits                                            │
│                                                                     │
│  HKSSF CSV adds 6 columns:                                         │
│    season, division, region, heat, points, record                   │
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
│  • Creates two tables:                                              │
│    - `results` (local, masters, regional) — 6 indexes              │
│    - `hkssf_results` (inter-school) — 7 indexes                   │
│                                                                     │
│  Output: swimming.db (SQLite, ~139 MB)                              │
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
│  • Also migrates `hkssf_results` if present in SQLite              │
│  • Batch inserts in 5,000-row chunks                                │
│  • Recreates all indexes                                            │
│  • Verifies row counts match                                        │
│  • Idempotent (safe to re-run)                                      │
│                                                                     │
│  Output: Neon PostgreSQL (via DATABASE_URL)                         │
│                                                                     │
│  20260322_143000_add_hkssf_results_to_pg.py                        │
│  ──────────────────────────────────────────                         │
│  • Standalone migration for hkssf_results only                     │
│  • Does NOT touch the existing results table                        │
│  • Uses swap-table strategy for zero downtime                      │
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
python scrape_results.py              # local competitions
python scrape_masters.py              # masters competitions
python scrape_hkssf_secondary.py      # HKSSF inter-school
python scrape_regional.py             # LCSD district results
python scrape_openwater.py            # open water results
python download_clubs.py              # club directory

# 2. Parse PDFs to CSV
python parsers/parse_results.py           # HY-TEK PDFs → CSV
python parsers/parse_hkssf_secondary.py   # HKSSF PDFs → CSV (separate table)
python parsers/parse_regional.py          # LCSD PDFs → CSV
python parsers/parse_openwater.py         # open water PDFs → CSV

# 3. Build SQLite database
python migrations/build_db.py         # CSV → swimming.db (results + hkssf_results)

# 4. Clean data
python migrations/fix_data.py         # normalize dates, names, times
python migrations/clean_db.py         # strip artifacts

# 5. Deploy to production
python migrations/migrate_to_pg.py    # full SQLite → Neon Postgres (both tables)
# OR for HKSSF-only:
python migrations/20260322_143000_add_hkssf_results_to_pg.py
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

### `results` table (local, masters, regional)
- **402,563** total results
- **16,701** unique swimmers
- **253** competitions (2014–2026)
- **99** clubs
- **~287** source PDFs

### `hkssf_results` table (inter-school)
- **65,843** total results
- **13,275** unique swimmers (by name, no IDs)
- **270** schools
- **9** seasons (2015–2025)
- **3** divisions, 4 regions
- **~42** source PDFs
