"""
Migrate swimming.db (SQLite) → PostgreSQL (Neon).

Usage:
    pip install psycopg2-binary
    export DATABASE_URL="postgresql://user:pass@host/dbname?sslmode=require"
    python migrate_to_pg.py

Safe to re-run — drops and recreates the table.
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

DB_PATH = os.path.join(os.path.dirname(__file__), "swimming.db")
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

    # Create table
    cur_p.execute("DROP TABLE IF EXISTS results CASCADE")
    cur_p.execute("""
        CREATE TABLE results (
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
            splits TEXT NOT NULL DEFAULT ''
        )
    """)
    pg_conn.commit()
    print("Created results table.")

    # Read all rows from SQLite
    cur_s.execute("SELECT COUNT(*) FROM results")
    total = cur_s.fetchone()[0]
    print(f"Migrating {total:,} rows...")

    cur_s.execute("""
        SELECT competition_id, competition_name, date, event_num,
               gender, age_group, distance, course, stroke, place,
               swimmer_id, swimmer_name, age, club,
               seed_time, finals_time, time_standard, splits
        FROM results
    """)

    batch_size = 5000
    batch = []
    count = 0

    cols = (
        "competition_id", "competition_name", "date", "event_num",
        "gender", "age_group", "distance", "course", "stroke", "place",
        "swimmer_id", "swimmer_name", "age", "club",
        "seed_time", "finals_time", "time_standard", "splits"
    )
    insert_sql = f"""
        INSERT INTO results ({', '.join(cols)})
        VALUES ({', '.join(['%s'] * len(cols))})
    """

    for row in cur_s:
        values = tuple(
            row[c] if row[c] is not None else (None if c in ('place', 'age') else '')
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

    # Create indexes
    print("Creating indexes...")
    indexes = [
        "CREATE INDEX idx_results_swimmer_id ON results(swimmer_id)",
        "CREATE INDEX idx_results_swimmer_name ON results(swimmer_name)",
        "CREATE INDEX idx_results_club ON results(club)",
        "CREATE INDEX idx_results_competition_id ON results(competition_id)",
        "CREATE INDEX idx_results_date ON results(date)",
        "CREATE INDEX idx_results_event ON results(distance, stroke, course, gender)",
    ]
    for idx in indexes:
        cur_p.execute(idx)
        pg_conn.commit()

    # Verify
    cur_p.execute("SELECT COUNT(*) FROM results")
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
