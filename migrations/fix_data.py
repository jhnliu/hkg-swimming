#!/usr/bin/env python3
"""Fix data quality issues in swimming.db."""

import os
import re
import sqlite3
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "swimming.db")

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    fixes = {}

    # 1. Fix dates in M/D/YYYY format -> YYYY-MM-DD
    cur.execute("SELECT DISTINCT date FROM results WHERE date != '' AND date NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'")
    bad_dates = [r[0] for r in cur.fetchall()]
    for d in bad_dates:
        try:
            parsed = datetime.strptime(d, "%m/%d/%Y")
            fixed = parsed.strftime("%Y-%m-%d")
            cur.execute("UPDATE results SET date = ? WHERE date = ?", (fixed, d))
            fixes[f"date {d}"] = f"-> {fixed} ({cur.rowcount} rows)"
        except ValueError:
            fixes[f"date {d}"] = "COULD NOT PARSE"

    # 2. Fix empty dates - extract from competition_name
    cur.execute("SELECT DISTINCT competition_name FROM results WHERE date = ''")
    for (comp_name,) in cur.fetchall():
        # Try patterns like "16/4/2016", "18/April/2021", "3/1/2015", "08-Mar-19"
        patterns = [
            (r"(\d{1,2}/\d{1,2}/\d{4})", "%d/%m/%Y"),
            (r"(\d{1,2}/\w+/\d{4})", "%d/%B/%Y"),
            (r"(\d{2}-\w{3}-\d{2})", "%d-%b-%y"),
            (r"(\d{2}-\w{3}-\d{4})", "%d-%b-%Y"),
            (r"(\d{1,2}/\w+/\d{4})", "%d/%b/%Y"),
        ]
        fixed_date = None
        for pattern, fmt in patterns:
            m = re.search(pattern, comp_name)
            if m:
                try:
                    parsed = datetime.strptime(m.group(1), fmt)
                    fixed_date = parsed.strftime("%Y-%m-%d")
                    break
                except ValueError:
                    continue

        if fixed_date:
            cur.execute("UPDATE results SET date = ? WHERE date = '' AND competition_name = ?",
                        (fixed_date, comp_name))
            fixes[f"empty date '{comp_name[:50]}'"] = f"-> {fixed_date} ({cur.rowcount} rows)"

    # 3. Fix X-prefixed finals times (exhibition swims - strip the X)
    cur.execute("UPDATE results SET finals_time = SUBSTR(finals_time, 2) WHERE finals_time LIKE 'X%'")
    fixes["X-prefix times"] = f"{cur.rowcount} rows stripped"

    # 4. Fix QT as finals_time (time_standard should be QT, finals_time should be seed_time value)
    # These are cases where the real time ended up in seed_time
    cur.execute("""UPDATE results SET time_standard = 'QT', finals_time = seed_time
                   WHERE finals_time = 'QT' AND time_standard = ''""")
    fixes["QT as finals_time"] = f"{cur.rowcount} rows fixed"

    # 5. Delete garbled rows (OCR artifacts)
    cur.execute("DELETE FROM results WHERE swimmer_name = '0' OR swimmer_id LIKE '%L o W%' OR finals_time LIKE '%L o W%'")
    fixes["garbled rows"] = f"{cur.rowcount} rows deleted"

    # Delete rows where swimmer_name is clearly garbage (single char, all digits, etc.)
    cur.execute("DELETE FROM results WHERE LENGTH(swimmer_name) <= 2 OR swimmer_name GLOB '[0-9]*'")
    fixes["garbage name rows"] = f"{cur.rowcount} rows deleted"

    # 6. Fix finals_time that still has standard suffix glued on (e.g. "1:00.00 qQT")
    cur.execute("""SELECT id, finals_time FROM results
                   WHERE finals_time GLOB '*[0-9] [a-zA-Z]*' AND finals_time NOT IN ('NS','SCR','DQ')""")
    time_std_fixes = 0
    for row_id, ft in cur.fetchall():
        parts = ft.rsplit(" ", 1)
        if len(parts) == 2 and re.match(r"^[\d:.]+$", parts[0]):
            cur.execute("UPDATE results SET finals_time = ?, time_standard = ? WHERE id = ?",
                        (parts[0], parts[1], row_id))
            time_std_fixes += 1
    fixes["time+standard glued"] = f"{time_std_fixes} rows split"

    # 7. Strip trailing non-numeric chars from finals_time (e.g. "55.80S" -> "55.80")
    # These are time standard suffixes glued directly onto the time without a space
    cur.execute("""SELECT id, finals_time FROM results
                   WHERE finals_time != '' AND finals_time NOT IN ('NS','SCR','DQ','DNF')
                   AND finals_time GLOB '*[0-9][a-zA-Z]*'
                   AND finals_time NOT GLOB '*:*[a-zA-Z]*:*'""")
    trailing_fixes = 0
    for row_id, ft in cur.fetchall():
        m = re.match(r'^([\d:.]+)([a-zA-Z]+)$', ft)
        if m:
            clean_time = m.group(1)
            std = m.group(2)
            cur.execute("UPDATE results SET finals_time = ?, time_standard = CASE WHEN time_standard = '' THEN ? ELSE time_standard END WHERE id = ?",
                        (clean_time, std, row_id))
            trailing_fixes += 1
    fixes["trailing letter in time"] = f"{trailing_fixes} rows cleaned"

    # 8. Normalize swimmer names - for each swimmer_id, pick the longest name variant
    cur.execute("""SELECT swimmer_id, swimmer_name, LENGTH(swimmer_name) as len
                   FROM results GROUP BY swimmer_id, swimmer_name ORDER BY swimmer_id, len DESC""")
    name_map = {}
    for sid, name, _ in cur.fetchall():
        if sid not in name_map:
            name_map[sid] = name  # longest first due to ORDER BY

    name_fixes = 0
    for sid, canonical_name in name_map.items():
        cur.execute("UPDATE results SET swimmer_name = ? WHERE swimmer_id = ? AND swimmer_name != ?",
                    (canonical_name, sid, canonical_name))
        name_fixes += cur.rowcount
    fixes["name normalization"] = f"{name_fixes} rows updated"

    conn.commit()

    # Print summary
    print("=== DATA FIXES APPLIED ===")
    for k, v in fixes.items():
        print(f"  {k}: {v}")

    # Verify
    print("\n=== POST-FIX STATS ===")
    for label, sql in [
        ("Empty dates", "SELECT COUNT(*) FROM results WHERE date = ''"),
        ("Bad date format", "SELECT COUNT(*) FROM results WHERE date != '' AND date NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'"),
        ("X-prefix times", "SELECT COUNT(*) FROM results WHERE finals_time LIKE 'X%'"),
        ("Name variants", "SELECT COUNT(*) FROM (SELECT swimmer_id FROM results GROUP BY swimmer_id HAVING COUNT(DISTINCT swimmer_name) > 1)"),
        ("Total results", "SELECT COUNT(*) FROM results"),
        ("Date range", "SELECT MIN(date) || ' to ' || MAX(date) FROM results WHERE date != ''"),
    ]:
        cur.execute(sql)
        print(f"  {label}: {cur.fetchone()[0]}")

    conn.close()

if __name__ == "__main__":
    main()
