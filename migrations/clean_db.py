"""
Clean swimming.db — fix known data quality issues.

Run after every rebuild of the database from CSVs:
    python clean_db.py

Safe to run multiple times (idempotent).
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "swimming.db")


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


def clean_finals_time_trailing_letters(cur: sqlite3.Cursor) -> int:
    """
    Strip trailing letter codes from finals_time.

    The PDF parser sometimes glues the time standard onto the time value
    (e.g. '55.80S', '2:15.50a', '1:03.43J', '24.50A', '59.52B').
    The trailing letter is a standard code (S/A/a/B/b/J) that belongs
    in time_standard, not in finals_time.
    """
    import re

    cur.execute(
        "SELECT id, finals_time FROM results "
        "WHERE finals_time != '' AND finals_time IS NOT NULL"
    )
    pattern = re.compile(r'^([\d:.]+)[A-Za-z]+$')
    updates = []
    for row_id, ft in cur:
        m = pattern.match(ft)
        if m:
            updates.append((m.group(1), row_id))

    if not updates:
        return 0

    cur.executemany(
        "UPDATE results SET finals_time = ? WHERE id = ?",
        updates
    )
    return len(updates)


def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    print(f"Cleaning {DB_PATH} ...")

    # --- Add cleanup steps here ---
    affected = clean_swimmer_id_hash(cur)
    print(f"  swimmer_id '#' fix: {affected} rows updated")

    affected = clean_finals_time_trailing_letters(cur)
    print(f"  finals_time trailing letters fix: {affected} rows updated")

    conn.commit()
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
