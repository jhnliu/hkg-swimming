"""
Migrate hkssf_results from SQLite → PostgreSQL (Neon).

Only touches the hkssf_results table — does NOT modify the existing results table.

Usage:
    pip install psycopg2-binary
    export DATABASE_URL="postgresql://user:pass@host/dbname?sslmode=require"
    python migrate_hkssf_to_pg.py
"""

import os
import sys
import sqlite3

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("Install psycopg2-binary:  pip install psycopg2-binary")
    sys.exit(1)

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "swimming.db")
DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    print("Set DATABASE_URL environment variable first.")
    print('  export DATABASE_URL="postgresql://user:pass@host/dbname?sslmode=require"')
    sys.exit(1)


def main():
    sqlite_conn = sqlite3.connect(DB_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    cur_s = sqlite_conn.cursor()

    pg_conn = psycopg2.connect(DATABASE_URL)
    cur_p = pg_conn.cursor()

    print("Connected to both databases.")

    # Check SQLite has the table
    cur_s.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='hkssf_results'")
    if not cur_s.fetchone():
        print("ERROR: No hkssf_results table in SQLite. Run build_db.py first.")
        sys.exit(1)

    # --- Step 1: Create staging table ---
    cur_p.execute("DROP TABLE IF EXISTS hkssf_results_new CASCADE")
    cur_p.execute("""
        CREATE TABLE hkssf_results_new (
            id SERIAL PRIMARY KEY,
            competition_id TEXT NOT NULL DEFAULT '',
            competition_name TEXT NOT NULL DEFAULT '',
            date TEXT NOT NULL DEFAULT '',
            event_num INTEGER NOT NULL DEFAULT 0,
            gender TEXT NOT NULL DEFAULT '',
            age_group TEXT NOT NULL DEFAULT '',
            distance TEXT NOT NULL DEFAULT '',
            course TEXT NOT NULL DEFAULT '',
            stroke TEXT NOT NULL DEFAULT '',
            place INTEGER,
            swimmer_id TEXT NOT NULL DEFAULT '',
            swimmer_name TEXT NOT NULL DEFAULT '',
            age INTEGER,
            club TEXT NOT NULL DEFAULT '',
            seed_time TEXT NOT NULL DEFAULT '',
            finals_time TEXT NOT NULL DEFAULT '',
            time_standard TEXT NOT NULL DEFAULT '',
            splits TEXT NOT NULL DEFAULT '',
            time_seconds DOUBLE PRECISION,
            season TEXT NOT NULL DEFAULT '',
            division TEXT NOT NULL DEFAULT '',
            region TEXT NOT NULL DEFAULT '',
            heat TEXT NOT NULL DEFAULT '',
            points INTEGER,
            record TEXT NOT NULL DEFAULT ''
        )
    """)
    pg_conn.commit()
    print("Created staging table (hkssf_results_new).")

    # --- Step 2: Bulk insert ---
    cur_s.execute("SELECT COUNT(*) FROM hkssf_results")
    total = cur_s.fetchone()[0]
    print(f"Migrating {total:,} rows...")

    cols = (
        "competition_id", "competition_name", "date", "event_num",
        "gender", "age_group", "distance", "course", "stroke", "place",
        "swimmer_id", "swimmer_name", "age", "club",
        "seed_time", "finals_time", "time_standard", "splits", "time_seconds",
        "season", "division", "region", "heat", "points", "record",
    )
    nullable_cols = ('place', 'age', 'time_seconds', 'points')
    insert_sql = f"""
        INSERT INTO hkssf_results_new ({', '.join(cols)})
        VALUES ({', '.join(['%s'] * len(cols))})
    """

    cur_s.execute(f"SELECT {', '.join(cols)} FROM hkssf_results")

    batch_size = 5000
    batch = []
    count = 0

    for row in cur_s:
        values = tuple(
            row[c] if row[c] is not None else (None if c in nullable_cols else '')
            for c in cols
        )
        batch.append(values)
        count += 1

        if len(batch) >= batch_size:
            psycopg2.extras.execute_batch(cur_p, insert_sql, batch)
            pg_conn.commit()
            batch = []
            print(f"  {count:,} / {total:,} ({count * 100 // total}%)")

    if batch:
        psycopg2.extras.execute_batch(cur_p, insert_sql, batch)
        pg_conn.commit()

    print(f"  {count:,} / {total:,} (100%)")

    # --- Step 3: Create indexes ---
    print("Creating indexes...")
    indexes = [
        "CREATE INDEX idx_hkssf_new_swimmer_name ON hkssf_results_new(swimmer_name)",
        "CREATE INDEX idx_hkssf_new_club ON hkssf_results_new(club)",
        "CREATE INDEX idx_hkssf_new_competition_id ON hkssf_results_new(competition_id)",
        "CREATE INDEX idx_hkssf_new_date ON hkssf_results_new(date)",
        "CREATE INDEX idx_hkssf_new_event ON hkssf_results_new(distance, stroke, course, gender)",
        "CREATE INDEX idx_hkssf_new_season ON hkssf_results_new(season)",
        "CREATE INDEX idx_hkssf_new_division ON hkssf_results_new(division)",
        "CREATE INDEX idx_hkssf_new_leaderboard ON hkssf_results_new(stroke, distance, course, time_seconds) WHERE time_seconds IS NOT NULL",
    ]
    for idx in indexes:
        cur_p.execute(idx)
        pg_conn.commit()

    # --- Step 4: Atomic swap ---
    print("Swapping tables...")
    cur_p.execute("BEGIN")
    cur_p.execute("DROP TABLE IF EXISTS hkssf_results_old CASCADE")
    cur_p.execute("DROP TABLE IF EXISTS hkssf_results CASCADE")
    cur_p.execute("ALTER TABLE hkssf_results_new RENAME TO hkssf_results")
    cur_p.execute("ALTER INDEX IF EXISTS idx_hkssf_new_swimmer_name RENAME TO idx_hkssf_swimmer_name")
    cur_p.execute("ALTER INDEX IF EXISTS idx_hkssf_new_club RENAME TO idx_hkssf_club")
    cur_p.execute("ALTER INDEX IF EXISTS idx_hkssf_new_competition_id RENAME TO idx_hkssf_competition_id")
    cur_p.execute("ALTER INDEX IF EXISTS idx_hkssf_new_date RENAME TO idx_hkssf_date")
    cur_p.execute("ALTER INDEX IF EXISTS idx_hkssf_new_event RENAME TO idx_hkssf_event")
    cur_p.execute("ALTER INDEX IF EXISTS idx_hkssf_new_season RENAME TO idx_hkssf_season")
    cur_p.execute("ALTER INDEX IF EXISTS idx_hkssf_new_division RENAME TO idx_hkssf_division")
    cur_p.execute("ALTER INDEX IF EXISTS idx_hkssf_new_leaderboard RENAME TO idx_hkssf_leaderboard")
    pg_conn.commit()
    print("Swap complete.")

    # --- Verify ---
    cur_p.execute("SELECT COUNT(*) FROM hkssf_results")
    pg_count = cur_p.fetchone()[0]
    print(f"\nDone! SQLite: {total:,} rows → Postgres: {pg_count:,} rows")

    if total != pg_count:
        print("WARNING: Row counts don't match!")
    else:
        print("Row counts match. Migration successful.")

    sqlite_conn.close()
    pg_conn.close()


if __name__ == "__main__":
    main()
