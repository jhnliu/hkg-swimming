#!/usr/bin/env python3
"""Parse open water swimming competition result PDFs into CSVs.

These PDFs are from hkgswimming.org.hk open water series. They have structured
data similar to HY-TEK but with different event headers and time formats:
- Event headers: "Event 3 Men 14-17 5km Open Water"
- Times: H:MM:SS.s (5km/10km) or MM:SS.s (1.5km/3.3km)
- Two column layouts: "Order Cap Reg Name Team Result Rank" or "Rank Cap Reg Name Team Result"
- Relay events (4x800m) are skipped.
"""

import csv
import re
import sys
from pathlib import Path

import pdfplumber

PDF_DIR = Path("/Users/jhnl/hkg-swimming/data/pdf/openwater")
OUTPUT_DIR = Path("/Users/jhnl/hkg-swimming/data/csv/openwater")

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

# ---------- Event header parsing ----------

# "Event 3 Men 14-17 5km Open Water"
# "Event 1 Men 14 or above 10km Open Water"
# "Event 5 Mixed 4x800m Freestyle Relay"
# "Event 1 Men Age 14-17 Group 10km Open Water"
EVENT_RE = re.compile(
    r"^Event\s+(\d+)\s+"                      # event number
    r"(Men|Women|Mixed)\s+"                    # gender
    r"(?:Age\s+)?"                             # optional "Age" prefix
    r"(.+?)\s+"                                # age group
    r"(\d+(?:\.\d+)?km|1500m|4x800m)\s+"      # distance
    r"(.+)$"                                   # stroke/type
)


def parse_event_header(line):
    """Parse an event header line. Returns dict or None."""
    line = line.strip()
    m = EVENT_RE.match(line)
    if not m:
        return None

    distance_raw = m.group(4)
    stroke = m.group(5).strip()
    is_relay = "Relay" in stroke or "x" in distance_raw

    return {
        "event_num": int(m.group(1)),
        "gender": m.group(2),
        "age_group": m.group(3).strip().rstrip("Group").strip(),
        "distance": distance_raw,
        "stroke": stroke,
        "is_relay": is_relay,
    }


# ---------- Result line parsing ----------

# Format 1 (5km/10km): "Order Cap Reg Name Team Result Rank"
#   28 2 48237 IAZ Wang, Yi Shun CPS 1:01:12.7 1
# Format 2 (1.5km): "Rank Cap Reg Name Team Result"
#   1 34 35022 IAZ Ip, Ali TPS 17:32.6

# Common pattern: a line starting with numbers, containing a swimmer ID, name, team, time, and optionally rank
RESULT_RE = re.compile(
    r"^(\d+)\s+"                                   # first number (order or rank)
    r"(\d+)\s+"                                    # cap number
    r"(\d{4,5}\s*[#@^A-Z0-9 ]*?)\s+"              # reg number (swimmer ID)
    r"([A-Z][a-z].+?)\s+"                          # name
    r"(\*?[A-Z]{2,4})\s+"                          # team
    r"(.+)$"                                       # result + optional rank
)

# Special results: DNF, NS, OTL, DQ, DNS
SPECIAL_RESULTS = {"DNF", "NS", "OTL", "DQ", "DNS", "DSQ"}


def parse_result_line(line, rank_first=False):
    """Parse a result line. Returns dict or None."""
    line = line.strip()
    if not line:
        return None

    m = RESULT_RE.match(line)
    if not m:
        return None

    first_num = int(m.group(1))
    swimmer_id = m.group(3).strip()
    name = m.group(4).strip()
    team = m.group(5).strip()
    remainder = m.group(6).strip()

    # Parse remainder: could be "1:01:12.7 1" or "17:32.6" or "DNF -" or "OTL -"
    # Remove trailing " -" for special results
    finals_time = ""
    place = None
    time_standard = ""

    parts = remainder.split()

    if len(parts) >= 1:
        time_or_status = parts[0]

        # Check for special status markers in the time field
        # e.g. "*SR" appearing before time
        if time_or_status.startswith("*"):
            time_standard = time_or_status.lstrip("*")
            # Shift: actual time is next
            if len(parts) >= 2:
                time_or_status = parts[1]
                parts = parts[1:]
            else:
                return {
                    "place": None, "swimmer_id": swimmer_id, "swimmer_name": name,
                    "club": team, "finals_time": "", "time_standard": time_standard,
                }

        if time_or_status in SPECIAL_RESULTS:
            time_standard = time_or_status
        elif re.match(r"^\d+:\d+[:.]\d+", time_or_status):
            finals_time = time_or_status
        elif re.match(r"^\d+[:.]\d+", time_or_status):
            finals_time = time_or_status

    # Determine place
    if rank_first:
        place = first_num if finals_time else None
    else:
        # Rank is in last part
        if len(parts) >= 2 and parts[-1].isdigit():
            place = int(parts[-1])
        elif len(parts) == 1 and finals_time:
            # No explicit rank column (format 2: rank is first_num)
            place = first_num

    return {
        "place": place,
        "swimmer_id": swimmer_id,
        "swimmer_name": name,
        "club": team,
        "finals_time": finals_time,
        "time_standard": time_standard,
    }


# ---------- Competition metadata ----------


def extract_comp_info(pages):
    """Extract competition name and date from PDF pages."""
    comp_name = ""
    comp_date = ""

    for page in pages[:2]:
        text = page.extract_text() or ""
        lines = text.split("\n")

        for line in lines:
            line = line.strip()
            if not comp_name and "Hong Kong Open Water" in line:
                comp_name = line
            if not comp_date:
                # Look for date patterns: "4 January 2026", "4th May 2025"
                dm = re.search(
                    r"(\d{1,2})(?:st|nd|rd|th)?\s+"
                    r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
                    r"(\d{4})",
                    line,
                )
                if dm:
                    import datetime
                    try:
                        dt = datetime.datetime.strptime(
                            f"{dm.group(1)} {dm.group(2)} {dm.group(3)}", "%d %B %Y"
                        )
                        comp_date = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        pass

            if comp_name and comp_date:
                break

    return comp_name, comp_date


# ---------- Main parser ----------


def parse_pdf(pdf_path):
    """Parse a single open water result PDF. Returns list of result dicts."""
    results = []

    try:
        pdf = pdfplumber.open(pdf_path)
    except Exception as e:
        print(f"  ERROR opening {pdf_path.name}: {e}", file=sys.stderr)
        return results

    comp_id = ""
    id_match = re.match(r"(\d+)_", pdf_path.stem)
    if id_match:
        comp_id = id_match.group(1)

    comp_name, comp_date = extract_comp_info(pdf.pages)

    current_event = None
    rank_first = False  # Whether rank is the first column

    for page in pdf.pages:
        text = page.extract_text()
        if not text:
            continue

        lines = text.split("\n")

        for line in lines:
            stripped = line.strip()

            # Check for event header
            if stripped.startswith("Event "):
                event_info = parse_event_header(stripped)
                if event_info:
                    current_event = event_info
                    rank_first = False  # Reset per event
                continue

            # Detect column header to determine layout
            if "Order" in stripped and "Cap" in stripped and "Rank" in stripped:
                rank_first = False  # Order first, Rank last
                continue
            if stripped.startswith("Rank") and "Cap" in stripped:
                rank_first = True  # Rank first, no separate rank column at end
                continue

            # Skip non-result lines
            if not current_event:
                continue
            if current_event.get("is_relay"):
                continue

            result = parse_result_line(stripped, rank_first)
            if result:
                result.update({
                    "competition_id": comp_id,
                    "competition_name": comp_name,
                    "date": comp_date,
                    "event_num": current_event["event_num"],
                    "gender": current_event["gender"],
                    "age_group": current_event["age_group"],
                    "distance": current_event["distance"],
                    "course": "OW",  # Open Water
                    "stroke": current_event["stroke"],
                    "age": "",
                    "seed_time": "",
                    "splits": "",
                })
                results.append(result)

    pdf.close()
    return results


def main():
    pdf_files = sorted(PDF_DIR.glob("*.pdf"))
    print(f"Found {len(pdf_files)} PDF files")

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
