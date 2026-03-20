"""
Clean swimming.db — fix known data quality issues.

Run after every rebuild of the database from CSVs:
    python clean_db.py

Safe to run multiple times (idempotent).
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "swimming.db")


def clean_swimmer_id_hash(cur: sqlite3.Cursor) -> int:
    """
    Strip '#' from swimmer_id.

    The HY-TEK PDF parser sometimes includes a '#' prefix before the
    time-standard suffix in the swimmer ID column (e.g. '48810 #B' instead
    of '48810 B'). This creates duplicate swimmer entries.
    """
    cur.execute(
        "SELECT COUNT(*) FROM results WHERE swimmer_id LIKE '%#%'"
    )
    count = cur.fetchone()[0]
    if count == 0:
        return 0

    cur.execute(
        "UPDATE results SET swimmer_id = REPLACE(swimmer_id, '#', '') "
        "WHERE swimmer_id LIKE '%#%'"
    )
    return count


def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    print(f"Cleaning {DB_PATH} ...")

    # --- Add cleanup steps here ---
    affected = clean_swimmer_id_hash(cur)
    print(f"  swimmer_id '#' fix: {affected} rows updated")

    conn.commit()
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
