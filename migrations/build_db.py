#!/usr/bin/env python3
"""Load all result CSVs into a SQLite database."""

import csv
import os
import re
import sqlite3
from pathlib import Path


def parse_time_to_seconds(time_str: str) -> float | None:
    """Convert a time string like '1:23.45' or '55.80' to seconds."""
    if not time_str:
        return None
    # Strip trailing non-numeric chars (e.g. "55.80S" -> "55.80")
    cleaned = re.sub(r'[^0-9:.]+$', '', time_str.strip())
    if not re.match(r'^[0-9]+([:.][0-9]+)*$', cleaned):
        return None
    parts = cleaned.split(':')
    try:
        if len(parts) == 3:
            return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
        if len(parts) == 2:
            return float(parts[0]) * 60 + float(parts[1])
        return float(parts[0])
    except (ValueError, IndexError):
        return None

BASE_DIR = Path(__file__).resolve().parent.parent
CSV_DIRS = [
    BASE_DIR / "data/csv/local_competition",
    BASE_DIR / "data/csv/masters",
    BASE_DIR / "data/csv/regional",
]
DB_PATH = BASE_DIR / "swimming.db"

def main():
    if DB_PATH.exists():
        DB_PATH.unlink()

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.executescript("""
        CREATE TABLE results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            competition_id TEXT,
            competition_name TEXT,
            date TEXT,
            event_num INTEGER,
            gender TEXT,
            age_group TEXT,
            distance TEXT,
            course TEXT,
            stroke TEXT,
            place INTEGER,
            swimmer_id TEXT,
            swimmer_name TEXT,
            age INTEGER,
            club TEXT,
            seed_time TEXT,
            finals_time TEXT,
            time_standard TEXT,
            splits TEXT,
            time_seconds REAL
        );

        CREATE INDEX idx_swimmer_id ON results(swimmer_id);
        CREATE INDEX idx_swimmer_name ON results(swimmer_name);
        CREATE INDEX idx_club ON results(club);
        CREATE INDEX idx_competition_id ON results(competition_id);
        CREATE INDEX idx_date ON results(date);
        CREATE INDEX idx_event ON results(distance, stroke, course, gender);
    """)

    csv_files = []
    for d in CSV_DIRS:
        if d.exists():
            csv_files.extend(sorted(d.glob("*.csv")))
    total = 0

    for f in csv_files:
        with open(f, encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            rows = []
            for row in reader:
                place = int(row["place"]) if row["place"] else None
                age = int(row["age"]) if row["age"] else None
                # Normalize swimmer_id: extract numeric part only
                raw_id = row["swimmer_id"].strip()
                id_match = re.match(r"(\d+)", raw_id)
                swimmer_id = id_match.group(1) if id_match else raw_id
                time_standard = row["time_standard"]
                finals_time = row["finals_time"]
                time_seconds = parse_time_to_seconds(finals_time) if finals_time else None
                rows.append((
                    row["competition_id"], row["competition_name"], row["date"],
                    int(row["event_num"]), row["gender"], row["age_group"],
                    row["distance"], row["course"], row["stroke"],
                    place, swimmer_id, row["swimmer_name"],
                    age, row["club"], row["seed_time"], finals_time,
                    time_standard, row["splits"], time_seconds,
                ))
            cur.executemany(
                "INSERT INTO results VALUES (NULL,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                rows
            )
            total += len(rows)

    conn.commit()
    print(f"Loaded {total} results from {len(csv_files)} CSVs")
    print(f"DB size: {DB_PATH.stat().st_size / 1024 / 1024:.1f} MB")

    # Quick stats
    for label, sql in [
        ("Unique swimmers", "SELECT COUNT(DISTINCT swimmer_id) FROM results"),
        ("Unique clubs", "SELECT COUNT(DISTINCT club) FROM results"),
        ("Unique competitions", "SELECT COUNT(DISTINCT competition_id) FROM results"),
        ("Date range", "SELECT MIN(date) || ' to ' || MAX(date) FROM results WHERE date != ''"),
    ]:
        cur.execute(sql)
        print(f"{label}: {cur.fetchone()[0]}")

    conn.close()

if __name__ == "__main__":
    main()
