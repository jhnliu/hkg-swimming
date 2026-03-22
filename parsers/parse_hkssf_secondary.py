#!/usr/bin/env python3
"""Parse HKSSF secondary school inter-school swimming competition PDFs into CSVs.

Handles 3 distinct PDF formats:
  - Format 1 (1516-1920): Old heat-by-heat text format with "HONG KONG SCHOOLS SPORTS FEDERATION" header
  - Format 2 (2122): Tabular, one event per page, finals only (8-9 swimmers)
  - Format 3 (2223-2425): Tabular, one event per page, all heats (20+ swimmers)

Output CSV matches the main results table schema plus HKSSF-specific columns.
"""

import csv
import re
import sys
from datetime import datetime
from pathlib import Path

import pdfplumber

BASE_DIR = Path(__file__).resolve().parent.parent
PDF_DIR = BASE_DIR / "data/pdf/hkssf_secondary"
OUTPUT_DIR = BASE_DIR / "data/csv/hkssf_secondary"

CSV_COLUMNS = [
    # Same as main results table
    "competition_id", "competition_name", "date",
    "event_num", "gender", "age_group",
    "distance", "course", "stroke",
    "place", "swimmer_id", "swimmer_name",
    "age", "club", "seed_time", "finals_time",
    "time_standard", "splits", "time_seconds",
    # HKSSF-specific
    "season", "division", "region",
    "heat", "points", "record",
]

STROKE_MAP = {
    "free style": "freestyle",
    "freestyle": "freestyle",
    "back stroke": "backstroke",
    "backstroke": "backstroke",
    "back sroke": "backstroke",
    "breast stroke": "breaststroke",
    "breaststroke": "breaststroke",
    "butterfly": "butterfly",
    "individual medley": "individual_medley",
    "indivdiual medley": "individual_medley",
    "medley relay": "medley_relay",
    "free style relay": "freestyle_relay",
    "freestyle relay": "freestyle_relay",
}

REGION_MAP = {
    "d1": "HK Island & Kowloon",
    "d2": "HK Island & Kowloon",
    "d3h": "Hong Kong Island",
    "d3hk": "Hong Kong Island",
    "d3k1": "Kowloon 1",
    "d3k2": "Kowloon 2",
}

MONTH_MAP = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}


# ---------- Utilities ----------

def normalize_stroke(raw):
    """Normalize stroke name to standard format."""
    # Remove trailing annotations like "(F)", "(M)"
    cleaned = re.sub(r"\s*\([A-Z]\)\s*$", "", raw.strip())
    return STROKE_MAP.get(cleaned.lower(), cleaned.lower())


def normalize_time(raw):
    """Normalize HKSSF time formats to standard M:SS.ss or SS.ss.

    Handles: "2: 4.28", "1 : 58.75", "2:17.46", "25.92", "1:12.09", ":55.34"
    """
    if not raw:
        return ""
    raw = raw.strip()
    if not raw or raw in ("-", "--", "---", "Y"):
        return ""
    # Handle trailing whitespace and status words
    raw = raw.rstrip()
    if raw.upper() in ("DQ", "DNS", "DNF"):
        return ""
    # Remove spaces around colons: "1 : 58.75" -> "1:58.75"
    raw = re.sub(r"\s*:\s*", ":", raw)
    # Skip truncated times like "3:" or "9:"
    if re.match(r"^\d+:$", raw):
        return ""
    # Handle ":55.34" -> "55.34" (sub-minute times)
    if raw.startswith(":"):
        raw = raw[1:]
    # Pad seconds: "2:4.28" -> "2:04.28"
    m = re.match(r"^(\d+):(\d+\.\d+)$", raw)
    if m:
        mins = m.group(1)
        secs = float(m.group(2))
        return f"{mins}:{secs:05.2f}"
    # Plain seconds
    m = re.match(r"^\d+\.\d+$", raw)
    if m:
        return raw
    return raw


def parse_time_to_seconds(time_str):
    """Convert time string to seconds."""
    if not time_str:
        return None
    try:
        parts = time_str.split(":")
        if len(parts) == 2:
            return float(parts[0]) * 60 + float(parts[1])
        if len(parts) == 1:
            return float(parts[0])
    except (ValueError, IndexError):
        pass
    return None


def parse_date(text):
    """Extract date from page text, return YYYY-MM-DD or empty string."""
    # "Day One: 28 October 2016" or "Day One Results 11 October 2023"
    m = re.search(
        r"(\d{1,2})\s+(January|February|March|April|May|June|July|August|"
        r"September|October|November|December)\s+(\d{4})",
        text, re.IGNORECASE
    )
    if m:
        day = int(m.group(1))
        month = MONTH_MAP[m.group(2).lower()]
        year = int(m.group(3))
        return f"{year:04d}-{month:02d}-{day:02d}"
    return ""


# ---------- Metadata extraction ----------

def extract_metadata(filename):
    """Extract season, division, region, competition_id from filename.

    Filename patterns:
      "1617 sw_results_d1.pdf"        -> file_type="results"
      "2526 sw_heats_d1.pdf"          -> file_type="heats"
      "2526 sw_finals_d1.pdf"         -> file_type="finals"
    """
    stem = Path(filename).stem
    m = re.match(r"(\d{4})\s+sw_(results|heats|finals)_(d\d\w*)", stem)
    if not m:
        return None

    season = m.group(1)
    file_type = m.group(2)
    div_code = m.group(3)
    division = div_code[1]  # "1", "2", or "3"
    region = REGION_MAP.get(div_code, "")
    competition_id = f"hkssf_{season}_{div_code}"
    file_type = file_type  # "results", "heats", or "finals"

    season_year = int("20" + season[:2]) if int(season[:2]) < 50 else int("19" + season[:2])
    season_str = f"{season_year}-{season_year + 1}"
    comp_name = f"Inter-School Swimming Competition {season_str}"
    if division == "1":
        comp_name += " Division One"
    elif division == "2":
        comp_name += " Division Two"
    elif division == "3":
        comp_name += f" Division Three ({region})"

    return {
        "season": season,
        "division": division,
        "div_code": div_code,
        "region": region,
        "competition_id": competition_id,
        "competition_name": comp_name,
        "file_type": file_type,
    }


# ---------- Format detection ----------

def detect_format(pages):
    """Detect PDF format based on content."""
    # Check first few non-empty pages
    for page in pages[:5]:
        text = page.extract_text() or ""
        if not text.strip():
            continue
        if "Rank" in text and "Name" in text and "School" in text:
            if "Lane" in text:
                return "tabular_with_heats"
            return "tabular_no_heats"
    # If no tabular header found, it's the old format
    return "old"


# ---------- Old format parser (1516-1920) ----------

# Event header: "Event 1 50m Free Style Boys A"
# Also handles: "Event 55 4x50m Medley Relay Boys C"
OLD_EVENT_RE = re.compile(
    r"^Event\s+(\d+)\s+"
    r"(\d+(?:x\d+)?m)\s+"
    r"(.+?)\s+"
    r"(Boys|Girls)\s+"
    r"([ABC])$"
)

# Standard/Record: "Standard: 30.00 Record: 24.24 (2013)"
OLD_STD_REC_RE = re.compile(
    r"Standard:\s*([\d:.]+)\s+Record:\s*([\d:.]+)"
)

# Heat/Final marker
OLD_HEAT_RE = re.compile(r"^(Heat|Final)\s*(\d+)?")

# School code pattern: 2+ uppercase chars, may contain digits/hyphens
# e.g. DBS, FSS-KT, PLKNO.1C, DMS-BW, SMCESPS, SEKSS-WK
# Must be at least 2 chars and start with uppercase letter
# Exclude single letter + dot (like "B.") which are name initials
SCHOOL_RE = r"[A-Z]{2}[A-Z0-9.\-]*|[A-Z][A-Z0-9.\-]{2,11}"


def parse_old_result_line(line):
    """Parse an old-format result line by finding the school code.

    The school code is the last all-uppercase token before the time/remainder.
    Returns (place, name, school, remainder) or None.
    """
    line = line.strip()
    m = re.match(r"^\s*(\d+)\s+(.+)$", line)
    if not m:
        return None

    place = int(m.group(1))
    rest = m.group(2)

    # Find school code: scan from right to left for uppercase-only token
    # The remainder starts with time-like content (digit, "DN", "DQ", "Standard")
    # Strategy: split by whitespace, find rightmost token that looks like a school code
    # where everything after it starts with a digit or DN/DQ/Standard
    tokens = rest.split()

    for i in range(len(tokens) - 1, 0, -1):
        tok = tokens[i]
        if re.match(r"^(" + SCHOOL_RE + r")$", tok):
            # Check: what follows should look like time/status
            after = " ".join(tokens[i + 1:]) if i + 1 < len(tokens) else ""
            if after and (re.match(r"[\d:]", after) or
                          after.startswith("DN") or
                          after.startswith("DQ") or
                          after.startswith("Standard")):
                name = " ".join(tokens[:i])
                school = tok
                remainder = after
                if name:  # Must have a name
                    return place, name, school, remainder

    return None


# Relay result: "1 DBS 1 : 47.28" or "1 SPCC 2: 5.05 Standard 4"
OLD_RELAY_RE = re.compile(
    r"^\s*(\d+)\s+"                # place
    r"([A-Z][A-Z0-9.\-]{1,11})\s+" # school code
    r"(.+)$"                       # remainder
)


def parse_old_remainder(remainder):
    """Parse the remainder after school code in old format.

    Returns (time_str, time_standard, points).
    Examples:
        "25.92 Standard 5"   -> ("25.92", "Y", 5)
        "2: 4.28 9"          -> ("2:04.28", "", 9)
        "DN start"           -> ("", "DNS", None)
        "DN Start"           -> ("", "DNS", None)
        "DQ"                 -> ("", "DQ", None)
        "30.13"              -> ("30.13", "", None)
        "1 : 7.05"           -> ("1:07.05", "", None)
        "2:10.01 Standard 1" -> ("2:10.01", "Y", 1)
    """
    remainder = remainder.strip()

    # DN Start / DN start / DN Finish
    if re.match(r"DN\s*(Start|start|Finish|finish)", remainder):
        return "", "DNS", None
    if re.match(r"DQ\s*$", remainder):
        return "", "DQ", None
    if re.match(r"DNS\s*$", remainder):
        return "", "DNS", None

    time_standard = ""
    points = None

    # Remove "Standard" and capture it
    if "Standard" in remainder:
        time_standard = "Y"
        remainder = remainder.replace("Standard", "").strip()

    # Remove "Final Lane" header text if it leaked in
    remainder = re.sub(r"Final\s*Lane", "", remainder).strip()

    # Split remaining into tokens
    # The remainder could be: "25.92 5" or "2: 4.28 9" or "1 : 58.75"
    # We need to reconstruct the time from tokens that look like time parts

    # First, try to find trailing integer(s) (points or lane)
    tokens = remainder.split()
    # Strip trailing integers (but NOT decimal numbers which could be times like "45.46")
    if tokens and re.match(r"^\d+$", tokens[-1]):
        points = int(tokens[-1])
        tokens = tokens[:-1]
        # Strip another trailing integer if present
        if tokens and re.match(r"^\d+$", tokens[-1]):
            tokens = tokens[:-1]

    # Reconstruct time from remaining tokens
    time_raw = " ".join(tokens)
    time_str = normalize_time(time_raw)

    return time_str, time_standard, points


def parse_old_format(pages, metadata):
    """Parse old format PDFs (1516-1920)."""
    results = []
    current_event = None
    current_heat = ""
    current_record = ""
    current_date = ""

    for page in pages:
        text = page.extract_text()
        if not text:
            continue

        lines = text.split("\n")

        # Skip summary pages (side-by-side format, no Event+Heat structure)
        # and standings pages
        page_text = text
        if "HONG KONG SCHOOLS SPORTS FEDERATION" not in page_text and "Event " not in page_text:
            # Summary pages at the beginning
            continue
        if "School Day 1" in page_text or "School A B C Total" in page_text:
            # School standings
            continue
        if "Position School" in page_text and "Total" in page_text:
            continue

        # Extract date from page header
        page_date = parse_date(page_text)
        if page_date:
            current_date = page_date

        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            # Skip non-result lines
            if stripped.startswith("=") or stripped.startswith("-"):
                continue
            if "HONG KONG SCHOOLS SPORTS FEDERATION" in stripped:
                continue
            if "Inter-School Swimming" in stripped or "Inter-school Swimming" in stripped:
                continue
            if "Regional Committee" in stripped:
                continue
            if "Division " in stripped and "Event" not in stripped:
                continue
            if stripped.startswith("Day ") and "Event" not in stripped:
                continue

            # Event header
            m = OLD_EVENT_RE.match(stripped)
            if m:
                event_num = int(m.group(1))
                distance = m.group(2)
                stroke_raw = m.group(3)
                gender = "M" if m.group(4) == "Boys" else "F"
                grade = m.group(5)
                is_relay = "x" in distance.lower()
                current_event = {
                    "event_num": event_num,
                    "distance": distance,
                    "stroke": normalize_stroke(stroke_raw),
                    "gender": gender,
                    "grade": grade,
                    "is_relay": is_relay,
                }
                current_heat = ""
                current_record = ""
                continue

            # Standard/Record line
            m = OLD_STD_REC_RE.search(stripped)
            if m:
                current_record = normalize_time(m.group(2))
                continue

            # Heat/Final marker
            m = OLD_HEAT_RE.match(stripped)
            if m:
                heat_type = m.group(1)
                heat_num = m.group(2) or ""
                current_heat = f"{heat_type} {heat_num}".strip()
                continue

            if not current_event:
                continue

            # Relay result
            if current_event.get("is_relay"):
                m = OLD_RELAY_RE.match(stripped)
                if m:
                    place = int(m.group(1))
                    school = m.group(2)
                    time_str, time_standard, points = parse_old_remainder(m.group(3))
                    if not time_str and time_standard not in ("DNS", "DQ"):
                        continue
                    time_seconds = parse_time_to_seconds(time_str)
                    results.append({
                        "competition_id": metadata["competition_id"],
                        "competition_name": metadata["competition_name"],
                        "date": current_date,
                        "event_num": current_event["event_num"],
                        "gender": current_event["gender"],
                        "age_group": current_event["grade"],
                        "distance": current_event["distance"],
                        "course": "LC",
                        "stroke": current_event["stroke"],
                        "place": place,
                        "swimmer_id": "",
                        "swimmer_name": school,
                        "age": "",
                        "club": school,
                        "seed_time": "",
                        "finals_time": time_str,
                        "time_standard": time_standard,
                        "splits": "",
                        "time_seconds": time_seconds,
                        "season": metadata["season"],
                        "division": metadata["division"],
                        "region": metadata["region"],
                        "heat": current_heat,
                        "points": points if points is not None else "",
                        "record": current_record,
                    })
                continue

            # Individual result
            parsed = parse_old_result_line(stripped)
            if parsed:
                place, name, school, remainder = parsed

                # Skip placeholder entries like "- - -"
                if name.replace("-", "").replace(" ", "") == "":
                    continue

                time_str, time_standard, points = parse_old_remainder(remainder)
                if not time_str and time_standard not in ("DNS", "DQ"):
                    continue
                time_seconds = parse_time_to_seconds(time_str)

                results.append({
                    "competition_id": metadata["competition_id"],
                    "competition_name": metadata["competition_name"],
                    "date": current_date,
                    "event_num": current_event["event_num"],
                    "gender": current_event["gender"],
                    "age_group": current_event["grade"],
                    "distance": current_event["distance"],
                    "course": "LC",
                    "stroke": current_event["stroke"],
                    "place": place,
                    "swimmer_id": "",
                    "swimmer_name": name,
                    "age": "",
                    "club": school,
                    "seed_time": "",
                    "finals_time": time_str,
                    "time_standard": time_standard,
                    "splits": "",
                    "time_seconds": time_seconds,
                    "season": metadata["season"],
                    "division": metadata["division"],
                    "region": metadata["region"],
                    "heat": current_heat,
                    "points": points if points is not None else "",
                    "record": current_record,
                })

    return results


# ---------- Tabular format parser (2122-2425) ----------

# Event header: "Event 1 Boys C Grade 200m Free Style Record : 2:00.26 Standard : 3:22.00"
# Some events don't have Standard (finals-only events)
TABULAR_EVENT_RE = re.compile(
    r"Event\s+(\d+)\s*-?\s*"
    r"(Boys|Girls)\s+"
    r"([ABC])\s+Grade\s+"
    r"(\d+(?:x\d+)?m)\s+"
    r"(.+?)\s+"
    r"Record\s*:\s*([\d:.]+)"
    r"(?:\s+Standard\s*:\s*([\d:.]+))?"
)

def parse_tabular_result_line(line):
    """Parse a tabular result line by finding the school code.

    Returns (place, name, school, remainder) or None.
    """
    line = line.strip()
    m = re.match(r"^\s*(\d+)\s+(.+)$", line)
    if not m:
        return None

    place = int(m.group(1))
    rest = m.group(2)
    tokens = rest.split()

    for i in range(len(tokens) - 1, 0, -1):
        tok = tokens[i]
        if re.match(r"^(" + SCHOOL_RE + r")$", tok):
            after = " ".join(tokens[i + 1:]) if i + 1 < len(tokens) else ""
            if after and (re.match(r"[\d:]", after) or after.startswith("Y")):
                name = " ".join(tokens[:i])
                school = tok
                remainder = after
                if name:
                    return place, name, school, remainder

    return None

# DQ/DNS lines (no rank number)
# e.g. "Si Ah Ching Taylor MCS DQ" or "Hung Tsz Yiu MSS DNS"
TABULAR_STATUS_RE = re.compile(
    r"^([A-Z][a-z].+?)\s+"     # name (starts with capital then lowercase)
    r"([A-Z][A-Z0-9.\-]{1,11})\s+" # school
    r"(DQ|DNS|DNF|DN\s*Start)\s*$"  # status
)

# Relay DQ/DNS: "HPCCSS DNS" or "KGV DNS"
TABULAR_RELAY_STATUS_RE = re.compile(
    r"^([A-Z][A-Z0-9.\-]{1,11})\s+(DQ|DNS|DNF|DN\s*Start)\s*$"
)

# DQ/DNS without school code: "Maksym Popov DNS"
TABULAR_STATUS_NOSCHOOL_RE = re.compile(
    r"^([A-Z][a-z].+?)\s+(DQ|DNS|DNF|DN\s*Start)\s*$"
)


def parse_tabular_remainder(remainder, has_lanes):
    """Parse the remainder after school code in tabular format.

    Returns (time_str, time_standard, points).
    """
    remainder = remainder.strip()

    # Handle "* New Record" suffix
    remainder = re.sub(r"\*\s*New\s*Record", "", remainder).strip()

    tokens = remainder.split()
    if not tokens:
        return "", "", None

    # If remainder starts with "Y" and no time-like token, it's a no-time entry
    # e.g. relay with "Y 4" (finalist, lane, no time recorded)
    if tokens[0] == "Y" and (len(tokens) < 2 or not re.match(r"^[\d:.]+$", tokens[1])):
        return "", "Y", None

    # First token should be the time
    time_str = normalize_time(tokens[0])
    if not time_str:
        return "", "", None

    remaining_tokens = tokens[1:]

    time_standard = ""
    points = None

    if has_lanes:
        # Format 3: time [Y lane] [standard_points]
        # "1:12.09 Y 4 1" -> time=1:12.09, finalist=Y, lane=4, std_points=1
        # "1:39.82 0" -> time=1:39.82, std_points=0
        if remaining_tokens and remaining_tokens[0] == "Y":
            time_standard = "Y"
            remaining_tokens = remaining_tokens[1:]
            # Skip lane number
            if remaining_tokens and re.match(r"^\d+$", remaining_tokens[0]):
                remaining_tokens = remaining_tokens[1:]
        # Last token is standard points
        if remaining_tokens and re.match(r"^\d+$", remaining_tokens[-1]):
            points = int(remaining_tokens[-1])
    else:
        # Format 2: time [final_points] [standard_points]
        # "2:04.17 9 1" -> time, final_pts=9, std_pts=1
        # "2:54.64 1" -> only standard points? Actually in Format 2, it's "final_points standard_points"
        # Points are the last tokens
        int_tokens = []
        for t in remaining_tokens:
            if re.match(r"^\d+$", t):
                int_tokens.append(int(t))
        if len(int_tokens) >= 1:
            points = int_tokens[0]  # final points
        # Check if "1" for standard
        if len(int_tokens) >= 2 and int_tokens[-1] == 1:
            time_standard = "Y"

    return time_str, time_standard, points


def parse_tabular_format(pages, metadata, has_lanes, day_type=None):
    """Parse tabular format PDFs (2122+).

    day_type: None (legacy combined), "heats", "finals", or "combined_timed_final"
    For "finals", events without Standard in header are Finals, with Standard are Timed Finals.
    """
    results = []
    current_event = None
    current_record = ""
    current_date = ""
    current_day = None  # "day_one" or "final_day", detected from page headers

    for page in pages:
        text = page.extract_text()
        if not text:
            continue

        # Skip standings/overall pages (but NOT "Running Total" pages that also have events)
        if "Position School" in text and "Event " not in text:
            continue
        if "Running Total" in text and "Event " not in text:
            continue
        if re.search(r"(Boys|Girls)\s+(Overall|[ABC]\s+Grade\s*\n)", text) and "Event " not in text:
            continue

        # Detect day from page header (for combined PDFs with day_type=None)
        if "Day One" in text or "Day Two" in text:
            current_day = "day_one"
        elif "Final Day" in text:
            current_day = "final_day"

        # Extract date
        page_date = parse_date(text)
        if page_date:
            current_date = page_date

        lines = text.split("\n")

        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            # Skip header lines
            if stripped.startswith("Inter-School Swimming"):
                continue
            if stripped.startswith("Division "):
                continue
            if re.match(r"^(Day|Final)\s+(One|Two|Three|Day)\s+(Results|Running)", stripped):
                continue
            if stripped.startswith("Rank ") or stripped == "Points":
                continue
            if "Standard" == stripped or "Points" == stripped:
                continue

            # Event header
            m = TABULAR_EVENT_RE.search(stripped)
            if m:
                event_num = int(m.group(1))
                gender = "M" if m.group(2) == "Boys" else "F"
                grade = m.group(3)
                distance = m.group(4)
                stroke_raw = m.group(5)
                record = normalize_time(m.group(6))
                has_standard = m.group(7) is not None
                is_relay = "x" in distance.lower()

                # Determine heat label
                if day_type == "heats":
                    heat_label = "Heat"
                elif day_type == "finals":
                    heat_label = "Timed Final" if has_standard else "Final"
                elif day_type == "combined_timed_final":
                    heat_label = "Timed Final"
                elif day_type is None and current_day:
                    # Legacy combined PDF — infer from page header
                    if current_day == "day_one":
                        if has_lanes:
                            # Format with lanes = true heats (2223+)
                            heat_label = "Heat"
                        else:
                            # No lanes format (2122) = single-day timed finals
                            heat_label = "Timed Final"
                    else:  # final_day
                        heat_label = "Timed Final" if has_standard else "Final"
                else:
                    heat_label = ""

                # Determine per-event has_lanes for remainder parsing
                if day_type == "finals":
                    event_has_lanes = False
                elif day_type == "heats":
                    event_has_lanes = has_lanes
                elif day_type is None and current_day == "final_day":
                    event_has_lanes = False
                else:
                    event_has_lanes = has_lanes

                current_event = {
                    "event_num": event_num,
                    "gender": gender,
                    "grade": grade,
                    "distance": distance,
                    "stroke": normalize_stroke(stroke_raw),
                    "is_relay": is_relay,
                    "has_standard": has_standard,
                    "heat_label": heat_label,
                    "has_lanes": event_has_lanes,
                }
                current_record = record
                continue

            if not current_event:
                continue

            # DQ/DNS lines (no rank)
            m = TABULAR_STATUS_RE.match(stripped)
            if not m:
                m = TABULAR_STATUS_NOSCHOOL_RE.match(stripped)
                if m:
                    # No school code — create a fake match with empty school
                    name = m.group(1).strip()
                    school = ""
                    status = m.group(2).strip()
                    if "DN" in status:
                        status = "DNS"
                    results.append({
                        "competition_id": metadata["competition_id"],
                        "competition_name": metadata["competition_name"],
                        "date": current_date,
                        "event_num": current_event["event_num"],
                        "gender": current_event["gender"],
                        "age_group": current_event["grade"],
                        "distance": current_event["distance"],
                        "course": "LC",
                        "stroke": current_event["stroke"],
                        "place": "",
                        "swimmer_id": "",
                        "swimmer_name": name,
                        "age": "",
                        "club": "",
                        "seed_time": "",
                        "finals_time": "",
                        "time_standard": status,
                        "splits": "",
                        "time_seconds": "",
                        "season": metadata["season"],
                        "division": metadata["division"],
                        "region": metadata["region"],
                        "heat": current_event.get("heat_label", ""),
                        "points": "",
                        "record": current_record,
                    })
                    continue
            if m and m.lastindex >= 3:
                name = m.group(1).strip()
                school = m.group(2)
                status = m.group(3)
                if "DN" in status:
                    status = "DNS"
                results.append({
                    "competition_id": metadata["competition_id"],
                    "competition_name": metadata["competition_name"],
                    "date": current_date,
                    "event_num": current_event["event_num"],
                    "gender": current_event["gender"],
                    "age_group": current_event["grade"],
                    "distance": current_event["distance"],
                    "course": "LC",
                    "stroke": current_event["stroke"],
                    "place": "",
                    "swimmer_id": "",
                    "swimmer_name": name,
                    "age": "",
                    "club": school,
                    "seed_time": "",
                    "finals_time": "",
                    "time_standard": status,
                    "splits": "",
                    "time_seconds": "",
                    "season": metadata["season"],
                    "division": metadata["division"],
                    "region": metadata["region"],
                    "heat": current_event.get("heat_label", ""),
                    "points": "",
                    "record": current_record,
                })
                continue

            # Relay result (tabular)
            if current_event.get("is_relay"):
                # Relay DNS/DQ: "HPCCSS DNS"
                m = TABULAR_RELAY_STATUS_RE.match(stripped)
                if m:
                    school = m.group(1)
                    status = "DNS" if "DN" in m.group(2) else m.group(2)
                    results.append({
                        "competition_id": metadata["competition_id"],
                        "competition_name": metadata["competition_name"],
                        "date": current_date,
                        "event_num": current_event["event_num"],
                        "gender": current_event["gender"],
                        "age_group": current_event["grade"],
                        "distance": current_event["distance"],
                        "course": "LC",
                        "stroke": current_event["stroke"],
                        "place": "",
                        "swimmer_id": "",
                        "swimmer_name": school,
                        "age": "",
                        "club": school,
                        "seed_time": "",
                        "finals_time": "",
                        "time_standard": status,
                        "splits": "",
                        "time_seconds": "",
                        "season": metadata["season"],
                        "division": metadata["division"],
                        "region": metadata["region"],
                        "heat": current_event.get("heat_label", ""),
                        "points": "",
                        "record": current_record,
                    })
                    continue

                # Relay lines: "1 DBS 1:47.28 9 1"
                m = re.match(
                    r"^\s*(\d+)\s+([A-Z][A-Z0-9.\-]{1,11})\s+(.+)$",
                    stripped
                )
                if m:
                    place = int(m.group(1))
                    school = m.group(2)
                    time_str, time_standard, points = parse_tabular_remainder(m.group(3), current_event["has_lanes"])
                    time_seconds = parse_time_to_seconds(time_str)
                    results.append({
                        "competition_id": metadata["competition_id"],
                        "competition_name": metadata["competition_name"],
                        "date": current_date,
                        "event_num": current_event["event_num"],
                        "gender": current_event["gender"],
                        "age_group": current_event["grade"],
                        "distance": current_event["distance"],
                        "course": "LC",
                        "stroke": current_event["stroke"],
                        "place": place,
                        "swimmer_id": "",
                        "swimmer_name": school,
                        "age": "",
                        "club": school,
                        "seed_time": "",
                        "finals_time": time_str,
                        "time_standard": time_standard,
                        "splits": "",
                        "time_seconds": time_seconds,
                        "season": metadata["season"],
                        "division": metadata["division"],
                        "region": metadata["region"],
                        "heat": current_event.get("heat_label", ""),
                        "points": points if points is not None else "",
                        "record": current_record,
                    })
                continue

            # Individual result
            parsed = parse_tabular_result_line(stripped)
            if parsed:
                place, name, school, remainder = parsed

                time_str, time_standard, points = parse_tabular_remainder(remainder, current_event["has_lanes"])
                if not time_str:
                    continue
                time_seconds = parse_time_to_seconds(time_str)

                results.append({
                    "competition_id": metadata["competition_id"],
                    "competition_name": metadata["competition_name"],
                    "date": current_date,
                    "event_num": current_event["event_num"],
                    "gender": current_event["gender"],
                    "age_group": current_event["grade"],
                    "distance": current_event["distance"],
                    "course": "LC",
                    "stroke": current_event["stroke"],
                    "place": place,
                    "swimmer_id": "",
                    "swimmer_name": name,
                    "age": "",
                    "club": school,
                    "seed_time": "",
                    "finals_time": time_str,
                    "time_standard": time_standard,
                    "splits": "",
                    "time_seconds": time_seconds,
                    "season": metadata["season"],
                    "division": metadata["division"],
                    "region": metadata["region"],
                    "heat": current_event.get("heat_label", ""),
                    "points": points if points is not None else "",
                    "record": current_record,
                })

    return results


# ---------- Main ----------

def parse_pdf(pdf_path, day_type=None):
    """Parse a single HKSSF secondary PDF. Returns list of result dicts.

    day_type: None (legacy/auto), "heats", "finals", or "combined_timed_final"
    """
    metadata = extract_metadata(pdf_path.name)
    if not metadata:
        print(f"  SKIP (cannot parse filename): {pdf_path.name}", file=sys.stderr)
        return []

    try:
        pdf = pdfplumber.open(pdf_path)
    except Exception as e:
        print(f"  ERROR opening {pdf_path.name}: {e}", file=sys.stderr)
        return []

    fmt = detect_format(pdf.pages)

    if fmt == "old":
        results = parse_old_format(pdf.pages, metadata)
    else:
        has_lanes = fmt == "tabular_with_heats"
        # For finals files, events without lanes use no-lanes parsing
        if day_type == "finals":
            # Finals PDF has mix: finals (no lanes) and timed finals (with lanes-like scoring)
            # Both use the no-lanes format (time [final_pts] [std_pts])
            has_lanes = False
        results = parse_tabular_format(pdf.pages, metadata, has_lanes, day_type)

        # For combined PDFs (day_type=None) with both Day One and Final Day,
        # remap Day One (Heat) event numbers to match Final Day canonical numbering
        if day_type is None and any(r["heat"] == "Heat" for r in results):
            finals_results = [r for r in results if r["heat"] in ("Final", "Timed Final")]
            if finals_results:
                event_map = build_event_map_from_finals(finals_results)
                heat_results = [r for r in results if r["heat"] == "Heat"]
                remap_heat_event_numbers(heat_results, event_map)

    pdf.close()
    return results


def build_event_map_from_finals(results):
    """Build a mapping from (gender, grade, distance, stroke) -> event_num from finals results.

    Used to remap heats event numbers to match finals canonical numbering.
    """
    event_map = {}
    for r in results:
        key = (r["gender"], r["age_group"], r["distance"], r["stroke"])
        if key not in event_map:
            event_map[key] = r["event_num"]
    return event_map


def remap_heat_event_numbers(heat_results, event_map):
    """Remap event numbers in heat results to match finals canonical numbering."""
    remapped = 0
    for r in heat_results:
        key = (r["gender"], r["age_group"], r["distance"], r["stroke"])
        if key in event_map:
            r["event_num"] = event_map[key]
            remapped += 1
    return remapped


def parse_split_division(heats_path, finals_path, metadata):
    """Parse a division with separate heats and finals PDFs (2526+ format).

    Returns combined results with proper heat/final classification and unified event numbers.
    """
    results = []

    # Parse finals first to get canonical event numbering
    if finals_path:
        print(f"  Parsing finals: {finals_path.name}", end="")
        finals_results = parse_pdf(finals_path, day_type="finals")
        print(f"  -> {len(finals_results)} results")
        event_map = build_event_map_from_finals(finals_results)
        results.extend(finals_results)
    else:
        event_map = {}

    # Parse heats and remap event numbers
    if heats_path:
        print(f"  Parsing heats:  {heats_path.name}", end="")
        heat_results = parse_pdf(heats_path, day_type="heats")
        if event_map:
            remapped = remap_heat_event_numbers(heat_results, event_map)
            print(f"  -> {len(heat_results)} results ({remapped} event nums remapped)")
        else:
            print(f"  -> {len(heat_results)} results")
        results.extend(heat_results)

    return results


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Collect all PDF files
    all_pdfs = sorted(
        f for f in PDF_DIR.glob("*.pdf")
        if "(1)" not in f.name
    )

    # Separate into legacy (sw_results) and split (sw_heats/sw_finals)
    legacy_pdfs = []
    heats_pdfs = {}  # keyed by (season, div_code)
    finals_pdfs = {}
    results_combined = {}  # single-file results like D3HK combined

    for pdf_path in all_pdfs:
        meta = extract_metadata(pdf_path.name)
        if not meta:
            print(f"  SKIP (cannot parse filename): {pdf_path.name}", file=sys.stderr)
            continue
        key = (meta["season"], meta["div_code"])
        if meta["file_type"] == "results":
            legacy_pdfs.append(pdf_path)
        elif meta["file_type"] == "heats":
            heats_pdfs[key] = pdf_path
        elif meta["file_type"] == "finals":
            finals_pdfs[key] = pdf_path

    # Find split divisions (have heats and/or finals files)
    split_keys = sorted(set(heats_pdfs.keys()) | set(finals_pdfs.keys()))

    total_files = len(legacy_pdfs) + len(split_keys)
    print(f"Found {len(legacy_pdfs)} legacy PDFs + {len(split_keys)} split divisions in {PDF_DIR}")

    total_results = 0
    errors = []
    counter = 0

    # Process legacy single-file PDFs
    for pdf_path in legacy_pdfs:
        counter += 1
        if pdf_path.stat().st_size == 0:
            print(f"[{counter}/{total_files}] {pdf_path.name}  -> SKIP (empty file)")
            continue

        csv_path = OUTPUT_DIR / (pdf_path.stem + ".csv")
        print(f"[{counter}/{total_files}] {pdf_path.name}", end="")

        try:
            meta = extract_metadata(pdf_path.name)
            # Check if this is a single-day combined format (all events are timed finals)
            # e.g. D3HK in 2526 which has no separate heats/finals
            day_type = None
            if meta and meta["season"] >= "2526":
                # For 2526+ results files (not heats/finals), treat as combined timed final
                day_type = "combined_timed_final"

            results = parse_pdf(pdf_path, day_type=day_type)
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

    # Process split heats+finals divisions
    for key in split_keys:
        counter += 1
        season, div_code = key
        heats_path = heats_pdfs.get(key)
        finals_path = finals_pdfs.get(key)

        csv_name = f"{season} sw_results_{div_code}.csv"
        csv_path = OUTPUT_DIR / csv_name
        print(f"[{counter}/{total_files}] {season} {div_code} (split format)")

        try:
            meta = extract_metadata((heats_path or finals_path).name)
            results = parse_split_division(heats_path, finals_path, meta)
            total_results += len(results)
            print(f"  Combined -> {len(results)} results")

            if results:
                # Sort by event_num then place for clean output
                results.sort(key=lambda r: (
                    int(r["event_num"]) if r["event_num"] else 999,
                    0 if r["heat"] == "Timed Final" else (1 if r["heat"] == "Heat" else 2),
                    int(r["place"]) if r["place"] else 999,
                ))
                with open(csv_path, "w", newline="", encoding="utf-8") as f:
                    writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
                    writer.writeheader()
                    writer.writerows(results)
        except Exception as e:
            print(f"  -> ERROR: {e}")
            errors.append((f"{season} {div_code}", str(e)))

    print(f"\n{'='*60}")
    print(f"Total results: {total_results}")
    print(f"Output dir: {OUTPUT_DIR}")
    if errors:
        print(f"Errors: {len(errors)}")
        for name, err in errors:
            print(f"  - {name}: {err}")


if __name__ == "__main__":
    main()
