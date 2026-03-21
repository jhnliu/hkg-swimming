"""
Add and populate time_seconds column on Neon PostgreSQL.

Parses finals_time in-database using SQL — no full re-migration needed.

Usage:
    python add_time_seconds.py
"""

import os
import sys

try:
    import psycopg2
except ImportError:
    print("Install psycopg2-binary:  pip install psycopg2-binary")
    sys.exit(1)


def get_database_url():
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
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
                        return line.split("=", 1)[1].strip().strip('"').strip("'")
    print("Set DATABASE_URL environment variable or add it to .env.local")
    sys.exit(1)


CLEAN_TIME = "REGEXP_REPLACE(finals_time, '[^0-9:.]+$', '')"

TIME_TO_SECONDS = f"""
CASE
  WHEN {CLEAN_TIME} ~ '^[0-9]+:[0-9]+:[0-9.]+$' THEN
    CAST(SPLIT_PART({CLEAN_TIME}, ':', 1) AS DOUBLE PRECISION) * 3600 +
    CAST(SPLIT_PART({CLEAN_TIME}, ':', 2) AS DOUBLE PRECISION) * 60 +
    CAST(SPLIT_PART({CLEAN_TIME}, ':', 3) AS DOUBLE PRECISION)
  WHEN {CLEAN_TIME} ~ '^[0-9]+:[0-9.]+$' THEN
    CAST(SPLIT_PART({CLEAN_TIME}, ':', 1) AS DOUBLE PRECISION) * 60 +
    CAST(SPLIT_PART({CLEAN_TIME}, ':', 2) AS DOUBLE PRECISION)
  WHEN {CLEAN_TIME} ~ '^[0-9.]+$' THEN
    CAST({CLEAN_TIME} AS DOUBLE PRECISION)
  ELSE NULL
END
"""


def main():
    conn = psycopg2.connect(get_database_url())
    cur = conn.cursor()

    # 1. Add column if not exists
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'results' AND column_name = 'time_seconds'
    """)
    if not cur.fetchone():
        print("Adding time_seconds column...")
        cur.execute("ALTER TABLE results ADD COLUMN time_seconds DOUBLE PRECISION")
        conn.commit()
    else:
        print("time_seconds column already exists.")

    # 2. Populate time_seconds for all rows with a parseable time
    print("Populating time_seconds from finals_time...")
    cur.execute(f"""
        UPDATE results
        SET time_seconds = {TIME_TO_SECONDS}
        WHERE finals_time != '' AND finals_time IS NOT NULL
          AND {CLEAN_TIME} ~ '^[0-9]+([:.][0-9]+)*$'
    """)
    updated = cur.rowcount
    print(f"  Updated {updated:,} rows with time_seconds.")

    conn.commit()

    # 4. Create partial index for leaderboard queries
    print("Creating leaderboard index...")
    cur.execute("DROP INDEX IF EXISTS idx_results_leaderboard")
    cur.execute("""
        CREATE INDEX idx_results_leaderboard
        ON results(stroke, distance, course, time_seconds)
        WHERE time_seconds IS NOT NULL
    """)
    conn.commit()

    # 5. Verify
    cur.execute("SELECT COUNT(*) FROM results WHERE time_seconds IS NOT NULL")
    count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM results")
    total = cur.fetchone()[0]
    print(f"\nDone! {count:,} / {total:,} rows have time_seconds.")

    conn.close()


if __name__ == "__main__":
    main()
