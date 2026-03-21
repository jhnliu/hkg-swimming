# Changelog

## 2026-03-21 — SEO, Appeals, Club Names & Data Reorganization

### SEO & Open Graph (`web/src/lib/seo.ts`)
- Added `alternatesForPath()` for `hreflang` links (en, zh, x-default) on every page
- Added `ogMeta()` helper for Open Graph title/description/image per page
- Root layout now sets `metadataBase`, bilingual description, structured keywords, and `robots` metadata
- All major pages (home, competitions, swimmer, club, leaderboards, trends) now export `generateMetadata` with per-page OG tags and canonical URLs

### Club name lookup (`download_clubs.py`, `web/src/lib/club-names.json`)
- New scraper downloads HKASA club directory PDFs (2019–2026) and extracts English + Chinese club names
- Produces `club-names.json` (90 clubs with EN/ZH names keyed by club code)
- `getClubName(code, lang)` in `db.ts` resolves codes to full names throughout the UI
- Club list, swimmer profile, search results, and breadcrumbs now show full club names instead of raw codes

### Appeals system
- New public appeals page (`/appeals`) — users can submit data corrections or report missing results
- Supports two appeal types: "Correction" (wrong data) and "Missing" (missing results)
- Admin review page (`/admin/appeals`) with approve/reject workflow and admin notes
- Database-backed: `submitAppeal()`, `getAppeals()`, `reviewAppeal()` in `db.ts`
- i18n: full EN/ZH translations for appeals UI

### Masters competition scraper (`scrape_masters.py`)
- Scrapes Masters (Advanced) swimming competition PDFs from hkgswimming.org.hk
- Covers LCM Championships, LCM, and SCM categories across multiple seasons
- PDFs saved to `data/pdf/masters/`, CSVs parsed to `data/csv/masters/`

### Data directory reorganization
- Reorganized flat file layout into structured directories:
  - `data/pdf/local_competition/`, `data/pdf/masters/`, `data/pdf/regional/`
  - `data/csv/local_competition/`, `data/csv/masters/`, `data/csv/clubs/`
- Removed old `data/profiles/`, `data/clubs.json`, `data/competitions.json`, `data/events.json`, `data/personal_bests.json` (all served from Postgres now)
- Updated paths in `build_data.py`, `build_db.py`, `parse_results.py`, `scrape_results.py`

### Leaderboard age group records
- Leaderboard now shows age group records (分齡記錄) alongside PB rankings

### Competition place in swimmer PBs
- Swimmer PB table now shows the place (名次) achieved at the competition where the PB was set

### Competition detail page refactor
- Switched from loading all results at once to per-event loading (`getCompetitionResultsByEvent`)
- Added event-based navigation for large competitions
- New `getSwimmerCompetitions()` and `getSwimmerResultsInCompetition()` queries

### Parser fix (`parse_results.py`)
- Club code regex now allows `#` prefix and digits (e.g. `#SPC`, `A01`) — previously only matched `*` prefix with letters

### Documentation
- Added `docs/DATABASE_SCHEMA.md` — Neon PostgreSQL schema reference
- Added `docs/DATA_PIPELINE.md` — end-to-end data flow documentation

## 2026-03-21 — Open Water Competition Scraper

### New scraper (`scrape_openwater.py`)
- Scrapes open water swimming result PDFs from `hkgswimming.org.hk/zh-hant/activities/134/`
- 8 events available (2022/23 – 2025/26 seasons), 1 PDF each
- PDFs contain structured results: swimmer IDs, names, teams, times, ranks (similar to HY-TEK but different event header format)
- Saved to `data/pdf/openwater/`
- Note: existing `parse_results.py` cannot parse these yet — event headers use open water format (`5km Open Water` vs `5000 LC Meter Freestyle`)

### Updated `/sync-results` command
- Added step 4 for open water competition sync

## 2026-03-21 — Regional Competition Scraper & Parser

### New scraper (`scrape_regional.py`)
- Scrapes LCSD district age-group swimming competition results from `lcsd.gov.hk`
- Covers all 18 Hong Kong districts, current season + last year
- Downloads both result PDFs (top-3 prize winners) and best-record PDFs per district
- PDFs saved to `data/pdf/regional/` with naming `{year}_{district}_{results|records}.pdf`
- Note: LCSD only retains current + 1 year of history — must run seasonally to archive
- Different format from HY-TEK (only top 3, not full results)

### New parser (`parse_regional.py`)
- Parses LCSD district competition PDFs into CSVs matching the existing data schema
- Handles wildly different formats across 18 districts:
  - Time formats: `2:27.36`, `28"67`, `27''73`, `0'33''77`, `00:25.22`, `1'34"96` — all normalized to `MM:SS.ss` / `SS.ss`
  - Table layouts: 5–8 columns, varying header structures
  - Gender: some districts put it in event names, others in page-level headers (e.g. Kwai Tsing)
- Extracts event (distance, stroke, gender), age group, swimmer name, place (1–3), and normalized time
- Record breakers (`*` markers) cleaned from names and tracked as `NR` in `time_standard`
- Relay events skipped (team-based)
- **7,043 results** parsed from 18 district PDFs (2025 season)

### Updated `/sync-results` command
- Added step 3 for regional competition sync

## 2026-03-21 — Scraper Improvements & Sync Command

### Scraper filtering (`scrape_results.py`)
- Only downloads PDFs labeled **比賽賽果** (competition results), skipping team scores (團體成績), staff lists (工作人員名單), schedules (比賽賽程), etc.
- Previously downloaded all PDFs blindly from each event page — 18 of the 30 unparseable PDFs were non-result documents that should never have been downloaded
- Filter works by checking the `<div class="file-name">` label preceding each savefile link

### New `/sync-results` command
- Added `.claude/commands/sync-results.md` — checks hkgswimming.org.hk for new local + masters competition results, downloads new PDFs, and parses them into CSVs

## 2026-03-21 — Leaderboard Filters & Swimmer PB Enhancements

### Leaderboard Filters (based on user feedback)
- Added **gender filter** (Male / Female) to leaderboards — maps to Men/Boys and Women/Girls in the data
- Added **age group filter** to leaderboards — filters by the event age group (e.g. 8 & Under, 9-10, 11-12, Open, etc.)
- Added **season filter** to leaderboards — filters by swimming season (July–June), with "All Time" as default
- All filters are URL-driven (`searchParams`), composable, and preserved when switching events
- Active filters shown as colored badges next to the event heading
- "Clear all" button resets filters while keeping the selected event
- New `getLeaderboard()` accepts `LeaderboardFilters` (gender, ageGroup, season)
- New `getLeaderboardFilterOptions()` returns available age groups and seasons from the data

### Swimmer PB Table Improvements
- PB tables now show **competition place** (finish position at the meet where the PB was set)
- Date column now **links to the competition page** with competition name as tooltip
- Table headers are now properly localized (were hardcoded English before)

### Files changed
- `web/src/lib/db.ts` — new `LeaderboardFilters` interface, updated `getLeaderboard()`, added `getLeaderboardFilterOptions()`, updated `getSwimmerPersonalBests()` to return `place` and `competition_name`, extended `PersonalBest` interface
- `web/src/app/[lang]/leaderboards/page.tsx` — gender/age group/season filter pills, filter-preserving event links, active filter badges
- `web/src/app/[lang]/swimmer/[id]/page.tsx` — place column, competition link, localized headers in PB table

## 2026-03-21 — Live on Vercel

Website is live at **hkg-swimming.vercel.app**.

### Readability Fix
- Fixed poor contrast in light mode: body text was dark blue on light blue background
- Background: `#f0f9ff` (light blue) → `#f8fafc` (near-white) for clean neutral base
- Foreground: `#0c4a6e` (dark blue) → `#0f172a` (near-black) for maximum readability
- Muted text: `#0369a1` (blue) → `#64748b` (slate gray) for proper secondary text
- Dark mode: foreground `#e0f2fe` → `#f1f5f9` (clean white), muted `#7dd3fc` → `#94a3b8` (slate)
- Swimming theme now expressed through nav, hero, accents, and borders — not body text

### Deployment
- Deployed to Vercel with Root Directory set to `web/`
- `DATABASE_URL` environment variable configured for Neon Postgres

## 2026-03-21 — Swimming Theme UI & Data Fixes

### Swimming-Themed UI Overhaul
- Replaced generic zinc/gray palette with pool-inspired color system:
  - Light mode: pool tile white (`#f0f9ff`) background, deep blue (`#0c4a6e`) foreground
  - Dark mode: night ocean (`#0b1a2e`) background, sky blue (`#e0f2fe`) foreground
  - Custom CSS variables: `--pool-deep`, `--pool-mid`, `--pool-light`, `--surface`, `--surface-alt`
- **Nav**: deep blue gradient bar (`from-pool-deep via-pool-mid`) with white text, replacing flat white/dark bar
- **Home hero**: full gradient section (deep blue → sky) with SVG wave decoration at bottom and frosted glass search input
- **Stats cards**: left-side "pool depth marker" accent bar (`depth-card`) with category icons
- **Tables**: pool-themed header rows, `water-row` hover shimmer effect, alternating blue-tinted rows, `timing-display` class for monospace times with tabular numerals
- **Leaderboards & competitions**: gold/silver/bronze circular medal badges for top 3 placements
- **Filter pills**: gradient active state (`filter-active`) with subtle glow shadow
- **Section dividers**: `lane-line` dashed bottom border pattern mimicking pool lane ropes
- **Course badges**: LC = sky blue, SC = teal (replacing generic blue/emerald)
- **Swimmer profile**: card-style header with depth accent bar
- **Charts**: ocean blue primary color (`#0284c7`), pool-themed grid lines and tooltips
- **Dark mode**: deep navy/ocean palette with glowing blue accents instead of plain black
- Applied consistently across all 10+ pages and 7 components

### Data Quality Fixes
- **`finals_time` parsing** (`db.ts`): Fixed `CAST AS DOUBLE PRECISION` crash on values like `"55.80S"` (time standard letter glued to time)
  - Added `CLEAN_TIME` SQL helper: `REGEXP_REPLACE(finals_time, '[^0-9:.]+$', '')` strips trailing non-numeric chars before parsing
  - `TIME_TO_SECONDS` now uses `CLEAN_TIME` in all branches; fallback changed from `ELSE CAST(...)` to `ELSE NULL`
  - Added explicit `WHEN ... ~ '^[0-9.]+$'` check for plain seconds format
  - `VALID_TIME_FILTER` now requires cleaned time matches `'^[0-9]+([:.][0-9]+)*$'`
  - `getBiggestImprovers` query also validates time format before entering CTE pipeline
- **`fix_data.py`**: Added step 7 — strips trailing letter suffixes from `finals_time` in SQLite (e.g. `"55.80S"` → time `"55.80"`, standard `"S"` moved to `time_standard`)

### Bug Fixes
- Fixed `<Script>` tag warning in Next.js 16: moved theme-init from `next/script` (body) to `<script dangerouslySetInnerHTML>` in `<head>`
- Fixed "Functions cannot be passed to Client Components" error: moved `formatStroke`/`formatStrokeZh` logic into `StrokeTable` client component instead of passing functions as props across server/client boundary
- Fixed `improvers.map is not a function` error: added `CLEAN_TIME` regex validation to `getBiggestImprovers` WHERE clause to prevent NULL `time_seconds` from propagating through CTEs

## 2026-03-21 — Data Quality & Rebuild

### Parser fixes (`parse_results.py`)
- Fixed swimmer ID regex to capture `@P`, `#@ICO`, `@IAX` etc. as part of ID (was leaking into swimmer name, causing 10,913 rows with garbled names)
- Fixed date parsing: smart DD/MM/YYYY vs M/D/YYYY disambiguation (HY-TEK uses US format pre-2020, EU format post-2020)

### Database rebuild (`build_db.py`)
- Swimmer IDs now normalized to numeric-only (e.g. `30192` not `30192 B`) — suffix codes (`B`, `IAZ`, `@P`, `#IAX`, etc.) are registration type codes that change over time for the same person
- Reduced unique swimmers from 15,162 → **14,897** by merging suffix variants

### Data fixes (`fix_data.py`)
- Fixed 7 M/D/YYYY dates + extracted dates from competition names for 8 competitions with empty dates
- Stripped `X` prefix from 42 exhibition swim times
- Split 4,145 glued time+standard values (e.g. `1:00.00 qQT` → time `1:00.00`, standard `qQT`)
- Fixed 10 `J`-prefixed finals times (junior record marker in wrong field)
- Moved `QT` from finals_time to time_standard for 8 rows
- Normalized swimmer names to longest variant per ID (6,349 rows updated)
- Deleted 1 OCR-garbled row

### Final stats
- **342,327 results** | **14,897 swimmers** | **90 clubs** | **218 competitions** | 2014-12-30 to 2026-03-16
- Zero empty dates, zero bad date formats, zero non-numeric swimmer IDs, zero name variants

### Gender Display Fix
- Fixed swimmer profile page showing all swimmers as "Women" / 女子
- Cause: gender check used old `"M"`/`"F"` format but DB stores `"Men"`/`"Boys"`/`"Women"`/`"Girls"`
- Updated to match `"Men" || "Boys"` → male, consistent with club and competition pages

## 2026-03-21 — PB Progression Chart

### Swimmer Profile Chart (`/swimmer/[id]`)
- Built interactive PB progression chart using Recharts (`PbChart` client component)
- **All events view**: each event as a separate colored line, clickable legend to drill into one
- **Single event view**: blue dots for every result, green dashed step-line showing PB progression over time
- Event filter buttons to toggle between events
- Y-axis reversed (faster times = higher), formatted as MM:SS.ss
- Custom tooltip showing time, date, and competition name
- Added `getSwimmerTimeHistory` SQL query: returns all valid results for a swimmer ordered by date

## 2026-03-21 — UI Polish

### Dark/Light Mode
- Fixed broken dark mode: added `dark:` Tailwind variants to every component (was hardcoded light-only)
- Switched from `prefers-color-scheme` (auto) to class-based dark mode with manual toggle
- Added theme toggle button (sun/moon icon) in nav bar
- Persists preference in `localStorage`, falls back to system preference
- Inline script in `<head>` prevents flash of wrong theme on load

### Navigation
- Made nav sticky (`sticky top-0 z-40`) with translucent `backdrop-blur` background
- Added wave icon next to "HKG Swimming" logo
- Added mobile hamburger menu (was missing on small screens)

### Tables
- Added zebra striping (alternating row backgrounds) to all data tables
- Added sticky `<thead>` headers so column names stay visible when scrolling
- Applies to: competition results, PB tables, leaderboard, club roster, DataTable component

### Detail Pages
- Added breadcrumb navigation to swimmer, competition, and club detail pages
- Created reusable `Breadcrumb` component
- Added dynamic `<title>` metadata (`generateMetadata`) to swimmer, competition, and club pages

### Competitions Page
- Fixed layout breaking on mobile: competition rows now stack vertically on narrow screens (`flex-col sm:flex-row`)

### Home Page
- Added search icon (magnifying glass) to search input
- Shows 6 recent competitions (fills 3-col grid evenly)

### Footer
- Added "Not affiliated with HKASA" disclaimer
- Multi-line layout with data source attribution

## 2026-03-21

### PDF Parser (`parse_results.py`)
- Built HY-TEK Meet Manager PDF parser using `pdfplumber`
- Parses individual results: place, swimmer ID, name, age, club, seed time, finals time, time standard, splits
- Handles format variations across HY-TEK versions 5.0-8.0 (2014-2026)
- Supports time trials (Open events, OQTA/OSTB standards) and age group competitions (D1/D2/QT standards)
- Handles edge cases: tied places (`*16`), no-shows (`---`/`NS`), scratches (`SCR`), continuation events across pages
- Outputs one CSV per PDF to `results_csv/`
- Relay events skipped for now (different row structure - team-based, not individual)
- **380,327 total results** parsed from 282 PDFs into 252 CSVs, spanning 2015-2026
- Note: some competitions have `_1`, `_2` suffix PDFs (split parts from source site)

## 2026-03-21 — Project kickoff

- **18:00** — Created `scrape_results.py` to download competition result PDFs from hkgswimming.org.hk
- **18:30** — Created `PLAN.md` with initial project vision: data model, feature ideas, parsing challenges
- **18:45** — Added UI/UX flow, page structure, coach-first design decisions, bilingual support, confirmed tech stack (Next.js + Tailwind + Recharts + Fuse.js), and build order
- **18:50** — Created `CHANGELOG.md`
- **19:00** — Reviewed actual PDF formats (Div.2 age group + HK Open Championships), noted structural differences (standards, splits depth)
- **19:10** — Created `schema.ts` — full TypeScript data schema covering: Swimmer, Club, Competition, Event, Result, EventStandards, PersonalBest, SwimmerProfile, and pre-built JSON file structure
- **19:25** — Created mock data in `data/` directory: clubs (24), competitions (8), swimmers (15), events (6), results for 2 competitions (5332 + 5135), personal bests (16), 2 swimmer profiles, and search index
- **19:50** — Scaffolded Next.js 16 app in `web/` with pnpm, Tailwind, TypeScript, Recharts, Fuse.js
- **20:00** — Built full UI skeleton with bilingual i18n (`/en/`, `/zh/`):
  - Data layer (`lib/data.ts`) with typed loaders for all JSON files
  - i18n system (`lib/i18n.ts`) with EN/ZH dictionaries
  - Shared components: Nav (with language toggle), SearchBar (Fuse.js fuzzy search), DataTable (sortable + CSV export)
  - Pages: Home (search + recent competitions), Swimmer Profile (PBs + history), Competition (event results tables), Competitions list (grouped by season), Leaderboards (PB rankings by event), Clubs list, Club detail (roster), Compare (stub), Trends (stub)
  - All 11 routes verified returning 200
- **20:15** — Built `build_data.py` pipeline: CSV → JSON (swimmers, clubs, competitions, events, results, personal bests, profiles, search index). 18k swimmers, 218 competitions, 146k PBs, 17k profiles
- **20:30** — Plugged real data into frontend, verified all routes. Leaderboards page timed out loading 28MB personal_bests.json
- **20:45** — Switched data layer from JSON files to SQLite (`swimming.db`, 100MB). New `lib/db.ts` with `better-sqlite3` — all queries now sub-second:
  - Replaced JSON file loaders with SQL queries (competitions, results, swimmers, PBs, clubs, search)
  - Leaderboard uses `GROUP BY swimmer_id` + `ORDER BY time_seconds LIMIT 25` — instant
  - Swimmer PBs computed on-the-fly with SQL `MIN()` aggregation
  - Added `/search` page with server-side SQL `LIKE` search (replaced client-side Fuse.js for main search)
  - All 9 routes verified returning 200 with real data from SQLite
- **21:00** — Built Compare page (`/compare`):
  - Server-side swimmer search via query params (`?q1=Chan`)
  - Select two swimmers → head-to-head PB comparison across all shared events
  - Win counter, time diff display, faster swimmer highlighted in green
  - SQL: CTE joins each swimmer's PBs by (distance, stroke, course)
- **21:10** — Built Trends page (`/trends`):
  - Biggest Improvers: top 25 swimmers by % time drop in same event over last 12 months
  - Breakthrough Swims: most recent first-time qualifying standard achievements (D1, QT, AQT)
  - Both powered by SQL window functions (ROW_NUMBER, PARTITION BY)
  - All pages verified: trends 1.2s, compare 62ms with two swimmers selected
