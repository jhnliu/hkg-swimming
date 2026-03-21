"""
Standardize swimming results data in both local SQLite and Neon PostgreSQL.

Fixes:
  1. Stroke corruptions and inconsistencies
  2. Regional competition course (→ LC) and date backfill
  3. Age group normalization (prefix stripping, typo fixes)
  4. Time standard normalization
  5. Competition 5182 rename
  6. Add competition_type column

Usage:
    python standardize_data.py              # dry-run (SQLite only, prints changes)
    python standardize_data.py --apply      # apply to SQLite
    python standardize_data.py --apply-pg   # apply to both SQLite and Neon PostgreSQL
"""

import os
import sys
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "swimming.db")

# ---------------------------------------------------------------------------
# All fixes as (description, SQL) pairs.
# SQL uses ? placeholders for SQLite and %s for Postgres — we'll adapt at runtime.
# For simple UPDATE statements we just write raw SQL strings.
# ---------------------------------------------------------------------------

FIXES = [
    # --- 1. Stroke fixes ---
    (
        "Stroke: Butter(cid:976)ly → Butterfly",
        "UPDATE results SET stroke = 'Butterfly' WHERE stroke = 'Butter(cid:976)ly'",
    ),
    (
        "Stroke: Individual Medley → IM",
        "UPDATE results SET stroke = 'IM' WHERE stroke = 'Individual Medley'",
    ),
    (
        "Stroke: Butterfly Swim-off → Butterfly",
        "UPDATE results SET stroke = 'Butterfly' WHERE stroke = 'Butterfly Swim-off'",
    ),
    (
        "Stroke: Freestyle Swim-off → Freestyle",
        "UPDATE results SET stroke = 'Freestyle' WHERE stroke = 'Freestyle Swim-off'",
    ),
    (
        "Stroke: Freestyle Multi-Class → Freestyle",
        "UPDATE results SET stroke = 'Freestyle' WHERE stroke = 'Freestyle Multi-Class'",
    ),

    # --- 2. Regional: course → LC ---
    (
        "Regional: set course = LC",
        "UPDATE results SET course = 'LC' WHERE course = '' AND (competition_name LIKE '%區%' OR competition_name LIKE '%沙田%')",
    ),

    # --- 3. Regional: backfill date (all are 2025 district comps, use 2025-01-01 as approximate) ---
    (
        "Regional: backfill date → 2025-01-01",
        "UPDATE results SET date = '2025-01-01' WHERE date = '' AND (competition_name LIKE '%區%' OR competition_name LIKE '%沙田%')",
    ),

    # --- 4. Age group: fix typos ---
    (
        "Age group: Adult 25-24 → Adult 25-34",
        "UPDATE results SET age_group = 'Adult 25-34' WHERE age_group = 'Adult 25-24'",
    ),
    (
        "Age group: Youth 25-34 → Adult 25-34",
        "UPDATE results SET age_group = 'Adult 25-34' WHERE age_group = 'Youth 25-34'",
    ),
    (
        "Age group: Adult 19-34 → Adult 18-34",
        "UPDATE results SET age_group = 'Adult 18-34' WHERE age_group = 'Adult 19-34'",
    ),

    # --- 5. Age group: strip prefixes for regional ---
    (
        "Age group: Youth 9-12 → 9-12",
        "UPDATE results SET age_group = '9-12' WHERE age_group = 'Youth 9-12'",
    ),
    (
        "Age group: Youth 13-14 → 13-14",
        "UPDATE results SET age_group = '13-14' WHERE age_group = 'Youth 13-14'",
    ),
    (
        "Age group: Youth 13-17 → 13-17",
        "UPDATE results SET age_group = '13-17' WHERE age_group = 'Youth 13-17'",
    ),
    (
        "Age group: Youth 15-17 → 15-17",
        "UPDATE results SET age_group = '15-17' WHERE age_group = 'Youth 15-17'",
    ),
    (
        "Age group: Adult 18-24 → 18-24",
        "UPDATE results SET age_group = '18-24' WHERE age_group = 'Adult 18-24'",
    ),
    (
        "Age group: Adult 18-34 → 18-34",
        "UPDATE results SET age_group = '18-34' WHERE age_group = 'Adult 18-34'",
    ),
    (
        "Age group: Adult 25-34 → 25-34",
        "UPDATE results SET age_group = '25-34' WHERE age_group = 'Adult 25-34'",
    ),
    (
        "Age group: Adult 35-44 → 35-44",
        "UPDATE results SET age_group = '35-44' WHERE age_group = 'Adult 35-44'",
    ),
    (
        "Age group: Master 35 & Over → 35 & Over",
        "UPDATE results SET age_group = '35 & Over' WHERE age_group = 'Master 35 & Over'",
    ),
    (
        "Age group: Master 35-44 → 35-44",
        "UPDATE results SET age_group = '35-44' WHERE age_group = 'Master 35-44'",
    ),
    (
        "Age group: Master 45-54 → 45-54",
        "UPDATE results SET age_group = '45-54' WHERE age_group = 'Master 45-54'",
    ),
    (
        "Age group: Master 55 & Over → 55 & Over",
        "UPDATE results SET age_group = '55 & Over' WHERE age_group = 'Master 55 & Over'",
    ),

    # --- 6. Age group: bare labels (Islands District) → empty ---
    (
        "Age group: bare 'Youth' → ''",
        "UPDATE results SET age_group = '' WHERE age_group = 'Youth'",
    ),
    (
        "Age group: bare 'Adult' → ''",
        "UPDATE results SET age_group = '' WHERE age_group = 'Adult'",
    ),
    (
        "Age group: bare 'Master' → ''",
        "UPDATE results SET age_group = '' WHERE age_group = 'Master'",
    ),

    # --- 7. Time standard normalization ---
    (
        "Time standard: qQT → QT",
        "UPDATE results SET time_standard = 'QT' WHERE time_standard = 'qQT'",
    ),
    (
        "Time standard: AqQT → AQT",
        "UPDATE results SET time_standard = 'AQT' WHERE time_standard = 'AqQT'",
    ),
    (
        "Time standard: MqQT → MQT",
        "UPDATE results SET time_standard = 'MQT' WHERE time_standard = 'MqQT'",
    ),
    (
        "Time standard: D1QT → D1",
        "UPDATE results SET time_standard = 'D1' WHERE time_standard = 'D1QT'",
    ),
    (
        "Time standard: lowercase s → S",
        "UPDATE results SET time_standard = 'S' WHERE time_standard = 's'",
    ),
    (
        "Time standard: lowercase q → Q",
        "UPDATE results SET time_standard = 'Q' WHERE time_standard = 'q'",
    ),
    (
        "Time standard: BB → B",
        "UPDATE results SET time_standard = 'B' WHERE time_standard = 'BB'",
    ),

    # --- 8. Competition 5182 rename ---
    (
        "Competition 5182: Results → 2025-2026 第一組短池分齡游泳比賽 (第二節)",
        "UPDATE results SET competition_name = '2025-2026 第一組短池分齡游泳比賽 (第二節)' WHERE competition_id = '5182' AND competition_name = 'Results'",
    ),
]

# --- 9. Add competition_type column ---
COMPETITION_TYPE_UPDATES = [
    (
        "competition_type: regional",
        "UPDATE results SET competition_type = 'regional' WHERE competition_name LIKE '%區%' OR competition_name LIKE '%沙田%分齡%'",
    ),
    (
        "competition_type: masters",
        "UPDATE results SET competition_type = 'masters' WHERE competition_name LIKE '%Masters%' OR competition_name LIKE '%長青%' OR competition_name LIKE '%Master %' OR competition_name LIKE '%MS Swimming%'",
    ),
    (
        "competition_type: openwater",
        "UPDATE results SET competition_type = 'openwater' WHERE competition_name LIKE '%Open Water%' OR competition_name LIKE '%公開水域%'",
    ),
    (
        "competition_type: interport",
        "UPDATE results SET competition_type = 'interport' WHERE competition_name LIKE '%Interport%' OR competition_name LIKE '%埠際%'",
    ),
    (
        "competition_type: local (everything else)",
        "UPDATE results SET competition_type = 'local' WHERE competition_type = ''",
    ),
]


def count_affected_sqlite(cur, sql_stmt):
    """Convert UPDATE to SELECT COUNT(*) to preview affected rows."""
    # Extract the WHERE clause
    upper = sql_stmt.upper()
    idx = upper.find("WHERE")
    if idx == -1:
        return 0
    where_clause = sql_stmt[idx:]
    table = "results"
    cur.execute(f"SELECT COUNT(*) FROM {table} {where_clause}")
    return cur.fetchone()[0]


def run_dry(db_path):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    print("=" * 60)
    print("DRY RUN — showing affected row counts")
    print("=" * 60)

    total = 0
    for desc, stmt in FIXES:
        cnt = count_affected_sqlite(cur, stmt)
        total += cnt
        status = f"  [{cnt:>6} rows]" if cnt > 0 else "  [     0 rows] (skip)"
        print(f"{status}  {desc}")

    print(f"\n--- competition_type column (new) ---")
    for desc, stmt in COMPETITION_TYPE_UPDATES:
        # Can't count these without the column existing, just show description
        print(f"  [  new  ]  {desc}")

    print(f"\nTotal rows affected by fixes: {total:,}")
    conn.close()


def apply_sqlite(db_path):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    print("=" * 60)
    print(f"APPLYING to SQLite: {db_path}")
    print("=" * 60)

    total = 0
    for desc, stmt in FIXES:
        cur.execute(stmt)
        cnt = cur.rowcount
        total += cnt
        print(f"  [{cnt:>6} rows]  {desc}")

    # Add competition_type column if not exists
    cur.execute("PRAGMA table_info(results)")
    columns = [row[1] for row in cur.fetchall()]
    if "competition_type" not in columns:
        print("\nAdding competition_type column...")
        cur.execute("ALTER TABLE results ADD COLUMN competition_type TEXT NOT NULL DEFAULT ''")
    else:
        print("\ncompetition_type column already exists, resetting...")
        cur.execute("UPDATE results SET competition_type = ''")

    for desc, stmt in COMPETITION_TYPE_UPDATES:
        cur.execute(stmt)
        cnt = cur.rowcount
        total += cnt
        print(f"  [{cnt:>6} rows]  {desc}")

    conn.commit()
    print(f"\nTotal rows updated: {total:,}")
    print("SQLite changes committed.")
    conn.close()


def apply_pg():
    try:
        import psycopg2
    except ImportError:
        print("Install psycopg2-binary: pip install psycopg2-binary")
        sys.exit(1)

    # Try loading from .env.local or web/.env.local
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        base = os.path.join(os.path.dirname(__file__), "..")
        for env_path in [
            os.path.join(base, ".env.local"),
            os.path.join(base, "web", ".env.local"),
        ]:
            if os.path.exists(env_path):
                with open(env_path) as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("DATABASE_URL="):
                            database_url = line.split("=", 1)[1].strip().strip('"').strip("'")
                            break
            if database_url:
                break

    if not database_url:
        print("Set DATABASE_URL environment variable or add it to .env.local")
        sys.exit(1)

    conn = psycopg2.connect(database_url)
    cur = conn.cursor()

    print("=" * 60)
    print("APPLYING to PostgreSQL (Neon)")
    print("=" * 60)

    total = 0
    for desc, stmt in FIXES:
        cur.execute(stmt)
        cnt = cur.rowcount
        total += cnt
        print(f"  [{cnt:>6} rows]  {desc}")

    # Add competition_type column if not exists
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'results' AND column_name = 'competition_type'
    """)
    if not cur.fetchone():
        print("\nAdding competition_type column...")
        cur.execute("ALTER TABLE results ADD COLUMN competition_type TEXT NOT NULL DEFAULT ''")
    else:
        print("\ncompetition_type column already exists, resetting...")
        cur.execute("UPDATE results SET competition_type = ''")

    for desc, stmt in COMPETITION_TYPE_UPDATES:
        cur.execute(stmt)
        cnt = cur.rowcount
        total += cnt
        print(f"  [{cnt:>6} rows]  {desc}")

    conn.commit()
    print(f"\nTotal rows updated: {total:,}")
    print("PostgreSQL changes committed.")
    conn.close()


def main():
    args = sys.argv[1:]

    if "--apply-pg" in args:
        apply_sqlite(DB_PATH)
        print()
        apply_pg()
    elif "--apply" in args:
        apply_sqlite(DB_PATH)
    else:
        run_dry(DB_PATH)
        print("\nRun with --apply to apply to SQLite only.")
        print("Run with --apply-pg to apply to both SQLite and PostgreSQL.")


if __name__ == "__main__":
    main()
