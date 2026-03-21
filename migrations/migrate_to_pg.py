"""
Migrate swimming.db (SQLite) → PostgreSQL (Neon).

Usage:
    pip install psycopg2-binary
    export DATABASE_URL="postgresql://user:pass@host/dbname?sslmode=require"
    python migrate_to_pg.py

Uses a swap-table strategy for near-zero downtime:
  1. Load data into results_new
  2. Build indexes on results_new
  3. Atomic rename: results → results_old, results_new → results
  4. Drop results_old
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
    # Connect to SQLite
    sqlite_conn = sqlite3.connect(DB_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    cur_s = sqlite_conn.cursor()

    # Connect to Postgres
    pg_conn = psycopg2.connect(DATABASE_URL)
    cur_p = pg_conn.cursor()

    print("Connected to both databases.")

    # ================================================================
    # RESULTS TABLE
    # ================================================================

    # --- Step 1: Create staging table ---
    cur_p.execute("DROP TABLE IF EXISTS results_new CASCADE")
    cur_p.execute("""
        CREATE TABLE results_new (
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
            time_seconds DOUBLE PRECISION
        )
    """)
    pg_conn.commit()
    print("Created staging table (results_new).")

    # --- Step 2: Bulk insert into staging table ---
    cur_s.execute("SELECT COUNT(*) FROM results")
    total = cur_s.fetchone()[0]
    print(f"Migrating {total:,} results rows...")

    cur_s.execute("""
        SELECT competition_id, competition_name, date, event_num,
               gender, age_group, distance, course, stroke, place,
               swimmer_id, swimmer_name, age, club,
               seed_time, finals_time, time_standard, splits, time_seconds
        FROM results
    """)

    batch_size = 5000
    batch = []
    count = 0

    cols = (
        "competition_id", "competition_name", "date", "event_num",
        "gender", "age_group", "distance", "course", "stroke", "place",
        "swimmer_id", "swimmer_name", "age", "club",
        "seed_time", "finals_time", "time_standard", "splits", "time_seconds"
    )
    insert_sql = f"""
        INSERT INTO results_new ({', '.join(cols)})
        VALUES ({', '.join(['%s'] * len(cols))})
    """

    for row in cur_s:
        values = tuple(
            row[c] if row[c] is not None else (None if c in ('place', 'age', 'time_seconds') else '')
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

    # --- Step 3: Create indexes on staging table ---
    print("Creating indexes on results staging table...")
    indexes = [
        "CREATE INDEX idx_results_new_swimmer_id ON results_new(swimmer_id)",
        "CREATE INDEX idx_results_new_swimmer_name ON results_new(swimmer_name)",
        "CREATE INDEX idx_results_new_club ON results_new(club)",
        "CREATE INDEX idx_results_new_competition_id ON results_new(competition_id)",
        "CREATE INDEX idx_results_new_date ON results_new(date)",
        "CREATE INDEX idx_results_new_event ON results_new(distance, stroke, course, gender)",
        # Composite index for leaderboard queries — time_seconds enables fast sorted lookups
        "CREATE INDEX idx_results_new_leaderboard ON results_new(stroke, distance, course, time_seconds) WHERE time_seconds IS NOT NULL",
        # Composite index for competition listing queries
        "CREATE INDEX idx_results_new_competition ON results_new(competition_id, competition_name, course, date)",
        # Composite index for biggest improvers queries
        "CREATE INDEX idx_results_new_improvers ON results_new(stroke, date, time_seconds) WHERE time_seconds IS NOT NULL",
    ]
    for idx in indexes:
        cur_p.execute(idx)
        pg_conn.commit()

    # --- Step 4: Atomic swap ---
    print("Swapping results tables (atomic rename)...")
    cur_p.execute("BEGIN")
    cur_p.execute("DROP TABLE IF EXISTS results_old CASCADE")
    cur_p.execute("DROP TABLE IF EXISTS results CASCADE")
    cur_p.execute("ALTER TABLE results_new RENAME TO results")
    cur_p.execute("ALTER INDEX IF EXISTS idx_results_new_swimmer_id RENAME TO idx_results_swimmer_id")
    cur_p.execute("ALTER INDEX IF EXISTS idx_results_new_swimmer_name RENAME TO idx_results_swimmer_name")
    cur_p.execute("ALTER INDEX IF EXISTS idx_results_new_club RENAME TO idx_results_club")
    cur_p.execute("ALTER INDEX IF EXISTS idx_results_new_competition_id RENAME TO idx_results_competition_id")
    cur_p.execute("ALTER INDEX IF EXISTS idx_results_new_date RENAME TO idx_results_date")
    cur_p.execute("ALTER INDEX IF EXISTS idx_results_new_event RENAME TO idx_results_event")
    cur_p.execute("ALTER INDEX IF EXISTS idx_results_new_leaderboard RENAME TO idx_results_leaderboard")
    pg_conn.commit()
    print("Results swap complete.")

    # --- Verify results ---
    cur_p.execute("SELECT COUNT(*) FROM results")
    pg_count = cur_p.fetchone()[0]
    print(f"Results: SQLite {total:,} → Postgres {pg_count:,} {'OK' if total == pg_count else 'MISMATCH!'}")

    # ================================================================
    # HKSSF_RESULTS TABLE
    # ================================================================

    # Check if hkssf_results exists in SQLite
    cur_s.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='hkssf_results'")
    if cur_s.fetchone():
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
        print("\nCreated HKSSF staging table (hkssf_results_new).")

        cur_s.execute("SELECT COUNT(*) FROM hkssf_results")
        hkssf_total = cur_s.fetchone()[0]
        print(f"Migrating {hkssf_total:,} HKSSF rows...")

        hkssf_cols = (
            "competition_id", "competition_name", "date", "event_num",
            "gender", "age_group", "distance", "course", "stroke", "place",
            "swimmer_id", "swimmer_name", "age", "club",
            "seed_time", "finals_time", "time_standard", "splits", "time_seconds",
            "season", "division", "region", "heat", "points", "record",
        )
        nullable_cols = ('place', 'age', 'time_seconds', 'points')
        hkssf_insert_sql = f"""
            INSERT INTO hkssf_results_new ({', '.join(hkssf_cols)})
            VALUES ({', '.join(['%s'] * len(hkssf_cols))})
        """

        cur_s.execute(f"SELECT {', '.join(hkssf_cols)} FROM hkssf_results")
        batch = []
        count = 0

        for row in cur_s:
            values = tuple(
                row[c] if row[c] is not None else (None if c in nullable_cols else '')
                for c in hkssf_cols
            )
            batch.append(values)
            count += 1

            if len(batch) >= batch_size:
                psycopg2.extras.execute_batch(cur_p, hkssf_insert_sql, batch)
                pg_conn.commit()
                batch = []
                print(f"  {count:,} / {hkssf_total:,} ({count * 100 // hkssf_total}%)")

        if batch:
            psycopg2.extras.execute_batch(cur_p, hkssf_insert_sql, batch)
            pg_conn.commit()

        print(f"  {count:,} / {hkssf_total:,} (100%)")

        # Create HKSSF indexes
        print("Creating indexes on HKSSF staging table...")
        hkssf_indexes = [
            "CREATE INDEX idx_hkssf_new_swimmer_name ON hkssf_results_new(swimmer_name)",
            "CREATE INDEX idx_hkssf_new_club ON hkssf_results_new(club)",
            "CREATE INDEX idx_hkssf_new_competition_id ON hkssf_results_new(competition_id)",
            "CREATE INDEX idx_hkssf_new_date ON hkssf_results_new(date)",
            "CREATE INDEX idx_hkssf_new_event ON hkssf_results_new(distance, stroke, course, gender)",
            "CREATE INDEX idx_hkssf_new_season ON hkssf_results_new(season)",
            "CREATE INDEX idx_hkssf_new_division ON hkssf_results_new(division)",
            "CREATE INDEX idx_hkssf_new_leaderboard ON hkssf_results_new(stroke, distance, course, time_seconds) WHERE time_seconds IS NOT NULL",
        ]
        for idx in hkssf_indexes:
            cur_p.execute(idx)
            pg_conn.commit()

        # Atomic swap for hkssf_results
        print("Swapping HKSSF tables (atomic rename)...")
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
        print("HKSSF swap complete.")

        # Verify
        cur_p.execute("SELECT COUNT(*) FROM hkssf_results")
        hkssf_pg_count = cur_p.fetchone()[0]
        print(f"HKSSF: SQLite {hkssf_total:,} → Postgres {hkssf_pg_count:,} {'OK' if hkssf_total == hkssf_pg_count else 'MISMATCH!'}")
    else:
        print("\nNo hkssf_results table in SQLite, skipping.")

    print("\nMigration complete.")

    sqlite_conn.close()
    pg_conn.close()


if __name__ == "__main__":
    main()
