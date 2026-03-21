"""Create the teams table for the My Team feature."""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "web", ".env"))


def main():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS teams (
            code VARCHAR(30) PRIMARY KEY,
            name VARCHAR(100),
            swimmer_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """)

    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_teams_updated_at ON teams (updated_at DESC);
    """)

    conn.commit()
    cur.close()
    conn.close()
    print("teams table created successfully")


if __name__ == "__main__":
    main()
