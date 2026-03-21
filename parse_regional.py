#!/usr/bin/env python3
"""Parse LCSD district age-group swimming competition result PDFs into CSVs.

These PDFs have a completely different format from HY-TEK results:
- Only top-3 prize winners per event/age group
- No swimmer IDs, no clubs, no seed times
- Time formats vary wildly across districts
- Table-based layout extracted via pdfplumber
"""

import csv
import re
import sys
from pathlib import Path

import pdfplumber

PDF_DIR = Path("/Users/jhnl/hkg-swimming/data/pdf/regional")
OUTPUT_DIR = Path("/Users/jhnl/hkg-swimming/data/csv/regional")

# Match the same CSV columns as parse_results.py for schema compatibility
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

# ---------- Event parsing ----------

# English event text → (distance, stroke)
EVENT_PATTERNS = [
    (r"4\s*x\s*50m?\s+Medley\s*Relay", "4x50", "Medley Relay"),
    (r"4\s*x\s*50m?\s+Freestyle\s*Relay?", "4x50", "Freestyle Relay"),
    (r"(\d+)m?\s+Individual\s*Medley", None, "Individual Medley"),
    (r"(\d+)m?\s+Freestyle", None, "Freestyle"),
    (r"(\d+)m?\s+Backstroke", None, "Backstroke"),
    (r"(\d+)m?\s+Breaststroke", None, "Breaststroke"),
    (r"(\d+)m?\s+Butterfly", None, "Butterfly"),
]

# Chinese event text fallback
ZH_EVENT_PATTERNS = [
    (r"4\s*[xX×]\s*50米?\s*四式接力", "4x50", "Medley Relay"),
    (r"4\s*[xX×]\s*50米?\s*自由[泳式]接力", "4x50", "Freestyle Relay"),
    (r"(\d+)米?\s*個人四式", None, "Individual Medley"),
    (r"(\d+)米?\s*自由[泳式]", None, "Freestyle"),
    (r"(\d+)米?\s*背泳", None, "Backstroke"),
    (r"(\d+)米?\s*胸泳", None, "Breaststroke"),
    (r"(\d+)米?\s*蝶泳", None, "Butterfly"),
]


def parse_event_text(cell_text, page_gender=None):
    """Parse event info from a table cell.

    Returns (gender, distance, stroke, is_relay) or None.
    page_gender is used as fallback when gender isn't in the event cell itself
    (e.g. Kwai Tsing splits Men/Women across page sections).
    """
    if not cell_text:
        return None

    text = cell_text.replace("\n", " ").strip()

    # Determine gender from cell text
    gender = None
    if re.search(r"Men|男子", text):
        gender = "Men"
    elif re.search(r"Women|女子", text):
        gender = "Women"

    # Try English patterns first, then Chinese
    for patterns in [EVENT_PATTERNS, ZH_EVENT_PATTERNS]:
        for pattern, fixed_dist, stroke in patterns:
            m = re.search(pattern, text, re.IGNORECASE)
            if m:
                if fixed_dist:
                    distance = fixed_dist
                else:
                    distance = m.group(1)
                is_relay = "Relay" in stroke
                # Use page_gender as fallback if gender not in event cell
                g = gender or page_gender
                if g:
                    return g, distance, stroke, is_relay

    return None


def detect_page_gender(page):
    """Detect if a page has a gender header (e.g. Kwai Tsing format)."""
    tables = page.extract_tables()
    if not tables:
        return None
    # Check first few rows for gender in header
    for row in tables[0][:3]:
        for cell in row:
            if not cell:
                continue
            if re.search(r"男子組|Result\s*\(Men\)", cell):
                return "Men"
            if re.search(r"女子組|Result\s*\(Women\)", cell):
                return "Women"
    return None


# ---------- Age group parsing ----------

AGE_GROUP_MAP = {
    "先進組": "Master",
    "Master": "Master",
    "成年組": "Adult",
    "Adult": "Adult",
    "青少年組": "Youth",
    "Youth": "Youth",
}


def parse_age_group(row):
    """Extract age group category and age range from a row's cells."""
    category = ""
    age_range = ""

    for cell in row:
        if not cell:
            continue
        text = cell.strip()

        # Check for category labels
        for zh, en in AGE_GROUP_MAP.items():
            if zh in text or en in text:
                category = en
                break

        # Check for age range patterns
        age_match = re.search(
            r"(\d+)歲或以上|Aged?\s+(\d+)\s+or\s+above|"
            r"(\d+)歲或以下|Aged?\s+(\d+)\s+or\s+below|"
            r"(\d+)\s*[-–]\s*(\d+)",
            text,
        )
        if age_match:
            groups = age_match.groups()
            if groups[0]:
                age_range = f"{groups[0]} & Over"
            elif groups[1]:
                age_range = f"{groups[1]} & Over"
            elif groups[2]:
                age_range = f"{groups[2]} & Under"
            elif groups[3]:
                age_range = f"{groups[3]} & Under"
            elif groups[4] and groups[5]:
                age_range = f"{groups[4]}-{groups[5]}"

    if category and age_range:
        return f"{category} {age_range}"
    elif category:
        return category
    elif age_range:
        return age_range
    return ""


# ---------- Time normalization ----------


def normalize_time(raw):
    """Normalize various time formats to MM:SS.ss or SS.ss.

    Formats seen across districts:
    - 2:27.36          (standard)
    - 28"67            (SS"ss)
    - 27''73           (SS''ss)
    - 0'33''77         (M'SS''ss)
    - 1'14"38          (M'SS"ss)
    - 00:25.22         (00:SS.ss)
    - 0:28.04          (0:SS.ss)
    - 34.82            (SS.ss)
    - 02'44"95         (MM'SS"ss)
    """
    if not raw:
        return ""

    raw = raw.strip().lstrip("*")
    if not raw or raw in ("--", "-", "/", "---"):
        return ""

    # Remove record annotations
    raw = re.sub(r"\(.*?\)", "", raw).strip()

    # Standard MM:SS.ss or M:SS.ss
    m = re.match(r"^(\d+):(\d+)\.(\d+)$", raw)
    if m:
        mins, secs, frac = int(m.group(1)), int(m.group(2)), m.group(3)
        if mins == 0:
            return f"{secs}.{frac}"
        return f"{mins}:{secs:02d}.{frac}"

    # 00:SS.ss (leading zero minutes)
    m = re.match(r"^0{1,2}:(\d+)\.(\d+)$", raw)
    if m:
        return f"{m.group(1)}.{m.group(2)}"

    # M'SS"ss or MM'SS"ss (e.g. 1'34"96, 02'44"95)
    m = re.match(r'^(\d+)[\'\u2019](\d+)["\u201C\u201D](\d+)$', raw)
    if m:
        mins, secs, frac = int(m.group(1)), int(m.group(2)), m.group(3)
        if mins == 0:
            return f"{secs}.{frac}"
        return f"{mins}:{secs:02d}.{frac}"

    # 0'SS''ss or M'SS''ss (e.g. 0'33''77, 1'13''44)
    # Also handles 0'30'54 (single quote variant)
    m = re.match(r"^(\d+)[\'\u2019](\d+)[\'\u2019]{1,2}(\d+)$", raw)
    if m:
        mins, secs, frac = int(m.group(1)), int(m.group(2)), m.group(3)
        if mins == 0:
            return f"{secs}.{frac}"
        return f"{mins}:{secs:02d}.{frac}"

    # SS"ss (e.g. 28"67)
    m = re.match(r'^(\d+)["\u201C\u201D](\d+)$', raw)
    if m:
        return f"{m.group(1)}.{m.group(2)}"

    # SS''ss (e.g. 27''73)
    m = re.match(r"^(\d+)[\'\u2019]{2}(\d+)$", raw)
    if m:
        return f"{m.group(1)}.{m.group(2)}"

    # SS.ss (plain seconds)
    m = re.match(r"^(\d+)\.(\d+)$", raw)
    if m:
        return raw

    return ""


# ---------- Name/time extraction from cells ----------


def parse_result_cell(cell):
    """Extract swimmer name and time from a result cell.

    Cells typically look like:
        "Name\\nTime"
        "Name\\nTime\\n(record note)"
        "--"
        "/"
    """
    if not cell:
        return None, "", ""

    text = cell.strip()
    if text in ("--", "-", "/", "---", ""):
        return None, "", ""

    lines = [l.strip() for l in text.split("\n") if l.strip()]
    if not lines:
        return None, "", ""

    name = None
    time_str = ""
    record = ""

    for line in lines:
        clean = line.lstrip("*")
        # Skip record annotations
        if re.match(r"^\(.*\)$", clean) or "紀錄" in clean or "Record" in clean:
            if "*" in line or "破" in line:
                record = "NR"  # New Record
            continue
        # Skip age group labels that leak into result cells
        if clean in AGE_GROUP_MAP or re.match(r"^(Master|Adult|Youth)$", clean, re.IGNORECASE):
            continue

        normalized = normalize_time(clean)
        if normalized:
            time_str = normalized
            if line.startswith("*"):
                record = "NR"
        elif not name and re.search(r"[a-zA-Z\u4e00-\u9fff]", clean):
            # It's a name (contains letters or Chinese chars)
            name = clean.strip("* ")
            if line.startswith("*") or line.endswith("*"):
                record = "NR"

    return name, time_str, record


# ---------- Competition metadata ----------

DISTRICT_EN = {
    "東區": "Eastern",
    "灣仔": "Wan Chai",
    "中西區": "Central & Western",
    "南區": "Southern",
    "油尖旺": "Yau Tsim Mong",
    "深水埗": "Sham Shui Po",
    "九龍城": "Kowloon City",
    "黃大仙": "Wong Tai Sin",
    "觀塘": "Kwun Tong",
    "沙田": "Sha Tin",
    "西貢": "Sai Kung",
    "屯門": "Tuen Mun",
    "葵青": "Kwai Tsing",
    "元朗": "Yuen Long",
    "北區": "North",
    "大埔": "Tai Po",
    "荃灣": "Tsuen Wan",
    "離島": "Islands",
}


def extract_metadata(pdf_path, pages):
    """Extract competition name, district, and year from PDF content and filename."""
    # From filename: 2025_eastern_results.pdf
    stem = pdf_path.stem
    m = re.match(r"(\d{4})_(.+?)_(results|records)", stem)
    year = m.group(1) if m else ""
    district_key = m.group(2) if m else ""

    # Get district Chinese name from first page text
    comp_name = ""
    district_zh = ""
    if pages:
        text = pages[0].extract_text() or ""
        first_lines = text.split("\n")[:5]
        for line in first_lines:
            line = line.strip()
            # Look for "XX區分齡游泳比賽 YYYY"
            dm = re.search(r"(.{2,4}區?)分齡游泳比賽\s*(\d{4})?", line)
            if dm:
                district_zh = dm.group(1)
                comp_name = line
                break
            # English fallback
            em = re.search(r"(.+?)\s+District\s+Age\s+Group\s+Swimming", line, re.IGNORECASE)
            if em:
                comp_name = line
                break

    if not comp_name:
        district_en = DISTRICT_EN.get(district_zh, district_key.replace("_", " ").title())
        comp_name = f"{district_en} District Age Group Swimming Competition {year}"

    return {
        "year": year,
        "district_key": district_key,
        "district_zh": district_zh,
        "comp_name": comp_name,
    }


# ---------- Main parser ----------


def find_result_columns(row, ncols):
    """Identify which columns contain the 1st/2nd/3rd place results.

    Returns list of column indices for [winner, 1st_runner_up, 2nd_runner_up].
    The result columns are typically the last 3 columns with actual data.
    """
    # Find columns that have name+time data (contain newlines with time-like content)
    candidate_cols = []
    for i, cell in enumerate(row):
        if cell and "\n" in cell:
            name, time, _ = parse_result_cell(cell)
            if name and time:
                candidate_cols.append(i)

    if len(candidate_cols) >= 3:
        return candidate_cols[-3:]
    elif len(candidate_cols) >= 1:
        # Pad to handle fewer than 3 results
        return candidate_cols + [None] * (3 - len(candidate_cols))
    return None


def parse_pdf(pdf_path):
    """Parse a single regional result PDF. Returns list of result dicts."""
    results = []

    try:
        pdf = pdfplumber.open(pdf_path)
    except Exception as e:
        print(f"  ERROR opening {pdf_path.name}: {e}", file=sys.stderr)
        return results

    meta = extract_metadata(pdf_path, pdf.pages)
    comp_id = f"regional_{meta['year']}_{meta['district_key']}"

    current_event = None
    event_counter = 0
    page_gender = None

    for page in pdf.pages:
        # Detect page-level gender (e.g. Kwai Tsing format)
        detected = detect_page_gender(page)
        if detected:
            page_gender = detected

        tables = page.extract_tables()
        if not tables:
            continue

        for table in tables:
            for row in table:
                if not row:
                    continue

                # Check each cell for event info
                for cell in row:
                    if not cell:
                        continue
                    event_info = parse_event_text(cell, page_gender)
                    if event_info:
                        gender, distance, stroke, is_relay = event_info
                        event_counter += 1
                        current_event = {
                            "event_num": event_counter,
                            "gender": gender,
                            "distance": distance,
                            "stroke": stroke,
                            "is_relay": is_relay,
                        }
                        break

                if not current_event:
                    continue

                # Skip relay events (team names, not individual results)
                if current_event["is_relay"]:
                    continue

                # Try to extract age group from this row
                age_group = parse_age_group(row)

                # Find result cells (name + time)
                place_results = []
                for cell in row:
                    if not cell:
                        continue
                    name, time_str, record = parse_result_cell(cell)
                    if name and time_str:
                        place_results.append((name, time_str, record))

                if not place_results:
                    continue

                for place_idx, (name, time_str, record) in enumerate(place_results):
                    result = {
                        "competition_id": comp_id,
                        "competition_name": meta["comp_name"],
                        "date": "",
                        "event_num": current_event["event_num"],
                        "gender": current_event["gender"],
                        "age_group": age_group if age_group else "",
                        "distance": current_event["distance"],
                        "course": "",  # Not specified in regional PDFs
                        "stroke": current_event["stroke"],
                        "place": place_idx + 1,
                        "swimmer_id": "",
                        "swimmer_name": name,
                        "age": "",
                        "club": "",
                        "seed_time": "",
                        "finals_time": time_str,
                        "time_standard": record,
                        "splits": "",
                    }
                    results.append(result)

    pdf.close()
    return results


def main():
    pdf_files = sorted(PDF_DIR.glob("*_results.pdf"))
    print(f"Found {len(pdf_files)} result PDF files")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

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
