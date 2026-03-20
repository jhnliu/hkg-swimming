"""Create the feedback table in Neon Postgres."""

import os
import psycopg2

DATABASE_URL = os.environ["DATABASE_URL"]

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute("""
    CREATE TABLE IF NOT EXISTS feedback (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL DEFAULT 'Anonymous',
        category VARCHAR(20) NOT NULL DEFAULT 'feedback',
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
""")

cur.execute("""
    CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status)
""")
cur.execute("""
    CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC)
""")

conn.commit()
cur.close()
conn.close()
print("feedback table created successfully")
