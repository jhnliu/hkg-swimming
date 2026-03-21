"""Create the appeals table in Neon Postgres."""

import os
import psycopg2

DATABASE_URL = os.environ["DATABASE_URL"]

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute("""
    CREATE TABLE IF NOT EXISTS appeals (
        id SERIAL PRIMARY KEY,
        submitter_name VARCHAR(100) NOT NULL DEFAULT 'Anonymous',
        submitter_email VARCHAR(200),
        swimmer_name VARCHAR(200) NOT NULL,
        swimmer_id VARCHAR(50),
        competition_name VARCHAR(300),
        event_description VARCHAR(200),
        recorded_time VARCHAR(50),
        reason TEXT NOT NULL,
        requested_change TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        admin_note TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        reviewed_at TIMESTAMP WITH TIME ZONE
    )
""")

cur.execute("""
    ALTER TABLE appeals ADD COLUMN IF NOT EXISTS appeal_type VARCHAR(20) NOT NULL DEFAULT 'correction'
""")

cur.execute("""
    CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status)
""")
cur.execute("""
    CREATE INDEX IF NOT EXISTS idx_appeals_created ON appeals(created_at DESC)
""")

conn.commit()
cur.close()
conn.close()
print("appeals table created successfully")
