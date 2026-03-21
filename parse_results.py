#!/usr/bin/env python3
"""Parse HY-TEK Meet Manager swimming result PDFs into a flat CSV."""

import csv
import os
import re
import sys
from pathlib import Path

import pdfplumber

PDF_DIR = Path("/Users/jhnl/hkg-swimming/data/pdf/local_competition")
OUTPUT_DIR = Path("/Users/jhnl/hkg-swimming/data/csv/local_competition")

# ---------- regex patterns ----------

# HY-TEK header: extract competition name (line 2) and date from line 1
HYTEK_HEADER_RE = re.compile(
    r"HY-TEK's MEET MANAGER \d+\.\d+ - .+?(\d{1,2}/\w+/\d{4}|\d{2}/\d{2}/\d{4})\s+Page\s+\d+"
)
# Alternate date formats in the header line
DATE_IN_HEADER_RE = re.compile(
    r"(\d{1,2}/\w+/\d{4}|\d{1,2}-\w+-\d{2,4}|\d{2}/\d{2}/\d{4})"
)

# Event header: "Event 1 Men 200 LC Meter IM" or "Event 1 Girls 13-14 200 LC Meter Freestyle"
EVENT_RE = re.compile(
    r"^(?:\()?Event\s+(\d+)\s+"           # event number
    r"(Men|Women|Boys|Girls)\s+"          # gender
    r"(.+?)\s+"                           # age group (e.g. "13-14", "8 & Under", or empty-ish for Open)
    r"(\d+)\s+"                           # distance
    r"(LC|SC)\s+Meter\s+"                 # course
    r"(.+?)\)?$"                          # stroke
)

# More flexible event header - handle "Open" being absent and age group variations
EVENT_RE2 = re.compile(
    r"^(?:\()?Event\s+(\d+)\s+"
    r"(Men|Women|Boys|Girls)\s+"
    r"((?:\d[\d &\-]*\s*(?:Yrs?|YRS?)(?:\s*&\s*(?:Under|Over|under|over))?|"
    r"\d+\s*(?:Yrs?|YRS?)\s*&\s*(?:Under|Over)|"
    r"Open)\s+)?"
    r"(\d+)\s+"
    r"(LC|SC)\s+Meter[s]?\s+"
    r"(.+?)\)?$"
)

# Relay event header
RELAY_RE = re.compile(
    r"^(?:\()?Event\s+(\d+)\s+"
    r"(Men|Women|Boys|Girls)\s+"
    r"(.+?)\s+"
    r"(\d+)x(\d+)\s+"
    r"(LC|SC)\s+Meter[s]?\s+"
    r"(.+?)\)?$"
)

# Continuation event: "(Event 7 Girls 15-16 100 LC Meter Breaststroke)"
CONTINUATION_RE = re.compile(r"^\(Event\s+\d+\s+")

# Column header line
COLUMN_HEADER_RE = re.compile(r"ID#\s+Name\s+Age\s+Team\s+Seed\s*Time\s+Finals\s*Time")

# Individual result row:
# place  ID  name  age  team  seed_time  finals_time  [standard]
# Examples:
#   1     30192 B  Whittington, Peter Harry  17  DLS  2:09.98  2:07.03J
#   ---   23653 IAZ  Cheung, Hoi Yan  14  DWA  1:26.95  NS
RESULT_RE = re.compile(
    r"^(\d+|\*\d+|---)\s+"                         # place (number, *number for tie, --- for no-show)
    r"(\d{4,5}\s*[#@^A-Z0-9 ]*?)\s+"              # ID# (e.g. "30192 B", "22447 #IAZ", "48950 @P", "47700 #@ICO")
    r"([A-Z][a-z].+?)\s+"                          # name (starts with uppercase letter then lowercase)
    r"(\d{1,2})\s+"                                 # age
    r"([#*]?[A-Z0-9]{2,4})\s+"                        # team (may start with # or *, can contain digits)
    r"(.+?)\s+"                                     # seed time
    r"(.+?)$"                                       # finals time + optional standard
)

# Relay result row: team-based
RELAY_RESULT_RE = re.compile(
    r"^(\d+)\s+"                          # place
    r"(.+?)\s+"                           # team name
    r"([A-Z])\s+"                         # relay designation (A, B, C...)
    r"(.+?)\s+"                           # seed time
    r"(.+?)$"                             # finals time + standard
)

# Relay member line: "1) Name Age 2) Name Age ..."
RELAY_MEMBER_RE = re.compile(r"\d+\)\s+.+?\s+\d{1,2}")

# Split times line: just numbers and colons
SPLIT_RE = re.compile(r"^[\d:.\s]+$")

# Qualifying standard labels
STANDARD_SUFFIXES = {"D1", "D2", "QT", "NS", "SCR", "DQ", "DNF", "DNS"}
TIME_STANDARD_RE = re.compile(r"([:\d.]+)\s*([A-Za-z]+)?$")


def normalize_date(date_str):
    """Convert various date formats to YYYY-MM-DD."""
    import datetime

    # Try different formats
    # Named month formats first (unambiguous)
    named_formats = [
        "%d/%B/%Y",      # 18/April/2021
        "%d/%b/%Y",      # 18/Apr/2021
        "%d-%b-%y",      # 26-Apr-21
        "%d-%b-%Y",      # 26-Apr-2021
        "%d-%B-%y",      # 26-April-21
    ]
    for fmt in named_formats:
        try:
            return datetime.datetime.strptime(date_str.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Numeric date: need to disambiguate DD/MM/YYYY vs M/D/YYYY
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", date_str.strip())
    if m:
        a, b, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if a > 12:  # must be DD/MM/YYYY
            return f"{year:04d}-{b:02d}-{a:02d}"
        elif b > 12:  # must be M/D/YYYY
            return f"{year:04d}-{a:02d}-{b:02d}"
        else:
            # Ambiguous - HY-TEK older versions use M/D/YYYY, newer use DD/MM/YYYY
            # Heuristic: if year >= 2020, likely DD/MM/YYYY; else M/D/YYYY
            if year >= 2020:
                return f"{year:04d}-{b:02d}-{a:02d}"  # DD/MM/YYYY
            else:
                return f"{year:04d}-{a:02d}-{b:02d}"  # M/D/YYYY

    return date_str


def parse_event_header(line):
    """Parse an event header line, return dict or None."""
    line = line.strip()

    # Try relay first
    m = RELAY_RE.match(line)
    if m:
        return {
            "event_num": int(m.group(1)),
            "gender": m.group(2),
            "age_group": m.group(3).strip(),
            "distance": f"{m.group(4)}x{m.group(5)}",
            "course": m.group(6),
            "stroke": m.group(7).strip(),
            "is_relay": True,
        }

    # Try standard event patterns
    for pattern in [EVENT_RE, EVENT_RE2]:
        m = pattern.match(line)
        if m:
            groups = m.groups()
            age_group = (groups[2] or "Open").strip()
            return {
                "event_num": int(groups[0]),
                "gender": groups[1],
                "age_group": age_group,
                "distance": groups[3],
                "course": groups[4],
                "stroke": groups[5].strip(),
                "is_relay": False,
            }

    # Fallback: simpler regex for edge cases
    m = re.match(
        r"^(?:\()?Event\s+(\d+)\s+(Men|Women|Boys|Girls)\s+(.+?)\s+(LC|SC)\s+Meter",
        line
    )
    if m:
        middle = m.group(3).strip()
        # Try to extract distance from middle
        dist_match = re.search(r"(\d+)\s*$", middle.split("Meter")[0] if "Meter" in middle else middle)
        # Extract what's after "Meter" for stroke
        after_meter = line.split("Meter")[-1].strip().rstrip(")")
        if dist_match:
            distance = dist_match.group(1)
            age_group = middle[:dist_match.start()].strip() or "Open"
        else:
            distance = ""
            age_group = middle

        is_relay = "x" in distance.lower() or "relay" in after_meter.lower()
        return {
            "event_num": int(m.group(1)),
            "gender": m.group(2),
            "age_group": age_group,
            "distance": distance,
            "course": m.group(4),
            "stroke": after_meter,
            "is_relay": is_relay,
        }

    return None


def parse_result_line(line):
    """Parse a result line. Returns dict or None."""
    line = line.strip()
    if not line:
        return None

    # Skip known non-result lines
    if line.startswith("ID#") or line.startswith("Team"):
        return None
    if CONTINUATION_RE.match(line):
        return None
    if "Qualifying Time" in line or "Meet Qualifying" in line:
        return None

    m = RESULT_RE.match(line)
    if not m:
        return None

    place_str = m.group(1).lstrip("*")
    place = None if place_str == "---" else int(place_str)

    swimmer_id = m.group(2).strip()
    name = m.group(3).strip()
    age = int(m.group(4))
    team = m.group(5).strip()

    seed_raw = m.group(6).strip()
    finals_raw = m.group(7).strip()

    # Extract time standard from finals time (e.g. "2:07.03J", "1:14.06 D1", "NS", "SCR")
    finals_time = finals_raw
    time_standard = ""

    if finals_raw in ("NS", "SCR", "DQ", "DNF", "DNS"):
        time_standard = finals_raw
        finals_time = ""
    else:
        # Check for standard suffix: "1:14.06 D1" or "2:07.03J" or "24.83H"
        parts = finals_raw.split()
        if len(parts) == 2 and parts[1] in STANDARD_SUFFIXES:
            finals_time = parts[0]
            time_standard = parts[1]
        elif len(parts) == 1:
            # Check for letter suffix: "2:07.03J", "24.83H", "1:54.89H", "25.76s"
            suffix_match = re.match(r"^([\d:.]+)([A-Za-z]+)$", parts[0])
            if suffix_match:
                finals_time = suffix_match.group(1)
                time_standard = suffix_match.group(2)

    return {
        "place": place,
        "swimmer_id": swimmer_id,
        "swimmer_name": name,
        "age": age,
        "club": team,
        "seed_time": seed_raw,
        "finals_time": finals_time,
        "time_standard": time_standard,
    }


def is_split_line(line):
    """Check if a line contains only split times."""
    stripped = line.strip()
    if not stripped:
        return False
    # Split lines are just numbers, colons, dots, and spaces
    return bool(re.match(r"^[\d:.\s]+$", stripped)) and (":" in stripped or "." in stripped)


def extract_competition_info(lines):
    """Extract competition name and date from the first HY-TEK header found."""
    comp_name = ""
    comp_date = ""

    for i, line in enumerate(lines):
        if "HY-TEK" in line:
            # Date is in this line
            date_match = DATE_IN_HEADER_RE.search(line)
            if date_match:
                comp_date = normalize_date(date_match.group(1))

            # Competition name is on the next line
            if i + 1 < len(lines):
                comp_name = lines[i + 1].strip()
            break

    return comp_name, comp_date


def parse_pdf(pdf_path):
    """Parse a single PDF file and return list of result dicts."""
    results = []

    try:
        pdf = pdfplumber.open(pdf_path)
    except Exception as e:
        print(f"  ERROR opening {pdf_path.name}: {e}", file=sys.stderr)
        return results

    comp_name = ""
    comp_date = ""
    comp_id = ""

    # Extract competition ID from filename
    filename = pdf_path.stem
    id_match = re.match(r"(\d+)_", filename)
    if id_match:
        comp_id = id_match.group(1)

    current_event = None

    for page in pdf.pages:
        text = page.extract_text()
        if not text:
            continue

        lines = text.split("\n")

        # Extract competition info from first results page
        if not comp_name:
            for i, line in enumerate(lines):
                if "HY-TEK" in line:
                    date_match = DATE_IN_HEADER_RE.search(line)
                    if date_match:
                        comp_date = normalize_date(date_match.group(1))
                    if i + 1 < len(lines):
                        comp_name = lines[i + 1].strip()
                    break

        # Skip pages without results
        if "Results" not in text and "ID#" not in text:
            continue

        for i, line in enumerate(lines):
            stripped = line.strip()

            # Check for event header
            if stripped.startswith("Event ") or stripped.startswith("(Event "):
                event_info = parse_event_header(stripped)
                if event_info:
                    current_event = event_info
                continue

            # Skip if no current event
            if current_event is None:
                continue

            # Skip relay events for now (different row format)
            if current_event.get("is_relay"):
                continue

            # Try to parse as result line
            result = parse_result_line(stripped)
            if result:
                result.update({
                    "competition_id": comp_id,
                    "competition_name": comp_name,
                    "date": comp_date,
                    "event_num": current_event["event_num"],
                    "gender": current_event["gender"],
                    "age_group": current_event["age_group"],
                    "distance": current_event["distance"],
                    "course": current_event["course"],
                    "stroke": current_event["stroke"],
                })

                # Check next line for splits
                if i + 1 < len(lines) and is_split_line(lines[i + 1]):
                    result["splits"] = lines[i + 1].strip()
                else:
                    result["splits"] = ""

                results.append(result)

    pdf.close()
    return results


CSV_COLUMNS = [
    "competition_id",
    "competition_name",
    "date",
    "event_num",
    "gender",
    "age_group",
    "distance",
    "course",
    "stroke",
    "place",
    "swimmer_id",
    "swimmer_name",
    "age",
    "club",
    "seed_time",
    "finals_time",
    "time_standard",
    "splits",
]


def main():
    pdf_files = sorted(PDF_DIR.glob("*.pdf"))
    print(f"Found {len(pdf_files)} PDF files")

    OUTPUT_DIR.mkdir(exist_ok=True)

    total_results = 0
    errors = []

    for i, pdf_path in enumerate(pdf_files):
        csv_path = OUTPUT_DIR / (pdf_path.stem + ".csv")
        print(f"[{i+1}/{len(pdf_files)}] {pdf_path.name}", end="")
        try:
            results = parse_pdf(pdf_path)
            total_results += len(results)
            print(f"  -> {len(results)} results")

            if results:
                with open(csv_path, "w", newline="", encoding="utf-8") as f:
                    writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
                    writer.writeheader()
                    writer.writerows(results)
        except Exception as e:
            print(f"  -> ERROR: {e}")
            errors.append((pdf_path.name, str(e)))

    print(f"\n{'='*60}")
    print(f"Total results: {total_results}")
    print(f"Output dir: {OUTPUT_DIR}")
    if errors:
        print(f"Errors: {len(errors)}")
        for name, err in errors:
            print(f"  - {name}: {err}")


if __name__ == "__main__":
    main()
