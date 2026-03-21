#!/usr/bin/env python3
"""
Transform parsed CSV results into JSON files for the Next.js frontend.

Reads:  data/csv/local_competition/*.csv
Writes: data/swimmers.json, data/clubs.json, data/competitions.json,
        data/events.json, data/results/{comp_id}.json,
        data/profiles/{swimmer_id}.json, data/personal_bests.json,
        data/search_index.json
"""

import csv
import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

CSV_DIR = Path("data/csv/local_competition")
OUT_DIR = Path("data")

# --- Helpers ---

STROKE_MAP = {
    "Freestyle": "freestyle",
    "Backstroke": "backstroke",
    "Breaststroke": "breaststroke",
    "Butterfly": "butterfly",
    "Butter(cid:976)ly": "butterfly",  # PDF extraction artifact
    "IM": "individual_medley",
    "Freestyle Relay": "freestyle_relay",
    "Freestyle Swim-off": "freestyle",
    "Butterfly Swim-off": "butterfly",
    "Freestyle Multi-Class": "freestyle",
}

GENDER_MAP = {
    "Men": "M",
    "Women": "F",
    "Boys": "M",
    "Girls": "F",
}

# Standards that indicate the swimmer didn't finish normally
NON_FINISH_STANDARDS = {"SCR", "DQ", "DNF", "NS"}

# Competition tier detection from name
def detect_tier(name):
    n = name.lower()
    if "open" in n or "公開" in n:
        return "open"
    if "championship" in n or "錦標賽" in n:
        return "championship"
    if "time trial" in n or "計時賽" in n:
        return "timetrial"
    if "inter-port" in n or "埠際" in n:
        return "interport"
    # Division/group detection
    if "div.i " in n or "div.1 " in n or "第一組" in n or "group i " in n:
        return "div1"
    if "div.ii" in n or "div.2 " in n or "第二組" in n or "group ii" in n:
        return "div2"
    if "div.iii" in n or "div.3 " in n or "第三組" in n or "group iii" in n:
        return "div3"
    return "other"


def detect_course(name, distance=None):
    """Detect course from competition name."""
    n = name.lower()
    if "short course" in n or "短池" in n or " sc " in n:
        return "SC"
    if "long course" in n or "長池" in n or " lc " in n:
        return "LC"
    return "LC"  # default


def parse_time_to_seconds(time_str):
    """Convert time string like '1:23.45' or '17:13.41' to seconds."""
    if not time_str or time_str in ("NT", "SCR", "DQ", "DNF", "NS", ""):
        return None
    time_str = time_str.strip()
    # Remove any trailing standard markers
    time_str = re.sub(r'[A-Za-z]+$', '', time_str).strip()
    try:
        parts = time_str.split(":")
        if len(parts) == 1:
            return float(parts[0])
        elif len(parts) == 2:
            return float(parts[0]) * 60 + float(parts[1])
        elif len(parts) == 3:
            return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
    except (ValueError, IndexError):
        return None
    return None


def parse_splits(splits_str):
    """Parse space-separated split times into list of cumulative seconds."""
    if not splits_str or not splits_str.strip():
        return []
    parts = splits_str.strip().split()
    result = []
    for p in parts:
        s = parse_time_to_seconds(p)
        if s is not None:
            result.append(round(s, 2))
    return result


def parse_place(place_str):
    """Parse place, returning int or None."""
    if not place_str:
        return None
    try:
        return int(place_str)
    except ValueError:
        return None


def parse_standards(std_str):
    """Parse time_standard field into list of standard codes."""
    if not std_str or not std_str.strip():
        return []
    std_str = std_str.strip()
    standards = []
    # Known standard codes
    known = ["AQT", "AqQT", "HQT", "MQT", "MqQT", "qQT", "QT", "D1", "D2",
             "BB", "H", "J", "A", "B", "Q", "S", "s", "q"]
    for k in sorted(known, key=len, reverse=True):
        if k in std_str:
            standards.append(k)
            std_str = std_str.replace(k, "", 1)
    return standards


def detect_status(place_str, std_str, finals_time):
    """Detect result status."""
    std = std_str.strip() if std_str else ""
    if "SCR" in std:
        return "SCR"
    if "DQ" in std:
        return "DQ"
    if "DNF" in std:
        return "DNF"
    if "NS" in std:
        return "DNS"
    if not finals_time or finals_time.strip() in ("", "NT"):
        return "SCR"
    return "ok"


def sanitize_filename(swimmer_id):
    """Make a filesystem-safe filename from swimmer ID."""
    return re.sub(r'[^a-zA-Z0-9]', '_', swimmer_id).strip('_')


def extract_comp_date_range(comp_name):
    """Try to extract date range from competition name like '15/08/2025 to 17/08/2025'."""
    m = re.search(r'(\d{1,2}/\d{1,2}/\d{4})\s+to\s+(\d{1,2}/\d{1,2}/\d{4})', comp_name)
    if m:
        return m.group(1), m.group(2)
    return None, None


# --- Main pipeline ---

def main():
    print("Reading CSVs...")
    csv_files = sorted(CSV_DIR.glob("*.csv"))
    print(f"Found {len(csv_files)} CSV files")

    # Accumulators
    all_rows = []
    competitions = {}  # comp_id -> Competition
    swimmers = {}  # swimmer_id -> Swimmer
    clubs = {}  # club_code -> Club
    events = {}  # event_key -> Event
    results_by_comp = defaultdict(list)  # comp_id -> [Result]

    # Per-swimmer tracking
    swimmer_clubs = defaultdict(lambda: defaultdict(lambda: {"first": "9999-99-99", "last": "0000-00-00"}))
    swimmer_genders = defaultdict(lambda: defaultdict(int))
    swimmer_names = defaultdict(lambda: defaultdict(int))
    swimmer_results = defaultdict(list)  # swimmer_id -> [(date, comp_id, event_key, time_seconds, age, ...)]

    for csv_file in csv_files:
        try:
            with open(csv_file, newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    all_rows.append(row)
        except Exception as e:
            print(f"  Error reading {csv_file.name}: {e}")

    print(f"Total rows: {len(all_rows)}")

    # Process all rows
    for row in all_rows:
        comp_id = row.get("competition_id", "").strip()
        comp_name = row.get("competition_name", "").strip()
        date = row.get("date", "").strip()
        event_num = row.get("event_num", "").strip()
        gender_raw = row.get("gender", "").strip()
        age_group = row.get("age_group", "").strip()
        distance = row.get("distance", "").strip()
        course = row.get("course", "").strip()
        stroke_raw = row.get("stroke", "").strip()
        place_raw = row.get("place", "").strip()
        swimmer_id = row.get("swimmer_id", "").strip()
        swimmer_name = row.get("swimmer_name", "").strip()
        age_raw = row.get("age", "").strip()
        club = row.get("club", "").strip()
        seed_time = row.get("seed_time", "").strip()
        finals_time = row.get("finals_time", "").strip()
        time_standard = row.get("time_standard", "").strip()
        splits_raw = row.get("splits", "").strip()

        if not comp_id or not swimmer_id:
            continue

        # Normalize
        gender = GENDER_MAP.get(gender_raw, "M")
        stroke = STROKE_MAP.get(stroke_raw, stroke_raw.lower())
        is_relay = "relay" in stroke_raw.lower()

        try:
            distance_int = int(distance) if distance else 0
        except ValueError:
            distance_int = 0

        try:
            age = int(age_raw) if age_raw else 0
        except ValueError:
            age = 0

        # Competition
        if comp_id not in competitions:
            comp_course = course if course in ("LC", "SC") else detect_course(comp_name)
            tier = detect_tier(comp_name)
            competitions[comp_id] = {
                "id": comp_id,
                "name_en": re.sub(r'\s*-\s*\d{1,2}/\d{1,2}/\d{4}.*$', '', comp_name).strip(),
                "date": date,
                "course": comp_course,
                "tier": tier,
            }
            # Check for date range
            _, end_date = extract_comp_date_range(comp_name)
            if end_date:
                # Parse dd/mm/yyyy to yyyy-mm-dd
                parts = end_date.split("/")
                if len(parts) == 3:
                    competitions[comp_id]["date_end"] = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"

        # Club
        if club and club not in clubs:
            clubs[club] = {"code": club}

        # Swimmer
        if swimmer_id not in swimmers:
            swimmers[swimmer_id] = {
                "id": swimmer_id,
                "name_en": swimmer_name,
                "gender": gender,
                "club_code": club,
            }

        # Track swimmer metadata
        swimmer_names[swimmer_id][swimmer_name] += 1
        swimmer_genders[swimmer_id][gender] += 1
        if club and date:
            tracker = swimmer_clubs[swimmer_id][club]
            if date < tracker["first"]:
                tracker["first"] = date
            if date > tracker["last"]:
                tracker["last"] = date

        # Event
        event_key = f"{comp_id}_{event_num}"
        if event_key not in events:
            events[event_key] = {
                "id": event_key,
                "competition_id": comp_id,
                "event_num": int(event_num) if event_num.isdigit() else 0,
                "gender": gender,
                "distance": distance_int,
                "stroke": stroke,
                "is_relay": is_relay,
                "age_group": age_group,
            }

        # Result
        status = detect_status(place_raw, time_standard, finals_time)
        place = parse_place(place_raw)
        finals_seconds = parse_time_to_seconds(finals_time) if status == "ok" else None
        standards = parse_standards(time_standard) if status == "ok" else []
        splits = parse_splits(splits_raw)

        result = {
            "event_id": event_key,
            "swimmer_id": swimmer_id,
            "swimmer_name": swimmer_name,
            "age": age,
            "club_code": club,
            "place": place,
            "seed_time": seed_time if seed_time and seed_time != "NT" else None,
            "finals_time": finals_time if status == "ok" else None,
            "finals_time_seconds": round(finals_seconds, 2) if finals_seconds else None,
            "status": status,
            "standards_achieved": standards,
            "splits": splits,
        }

        results_by_comp[comp_id].append(result)

        # Track for PBs (individual events only)
        if not is_relay and status == "ok" and finals_seconds:
            comp_course = competitions[comp_id]["course"]
            swimmer_results[swimmer_id].append({
                "date": date,
                "competition_id": comp_id,
                "stroke": stroke,
                "distance": distance_int,
                "course": comp_course,
                "time_seconds": round(finals_seconds, 2),
                "time": finals_time,
                "age": age,
            })

    # --- Finalize swimmers ---
    print("Finalizing swimmers...")
    for sid, s in swimmers.items():
        # Most common name
        if swimmer_names[sid]:
            s["name_en"] = max(swimmer_names[sid], key=swimmer_names[sid].get)
        # Most common gender
        if swimmer_genders[sid]:
            s["gender"] = max(swimmer_genders[sid], key=swimmer_genders[sid].get)
        # Most recent club
        club_data = swimmer_clubs[sid]
        if club_data:
            most_recent = max(club_data.items(), key=lambda x: x[1]["last"])
            s["club_code"] = most_recent[0]
        # Club history
        s["club_history"] = sorted(
            [
                {"club_code": c, "first_seen": d["first"], "last_seen": d["last"]}
                for c, d in club_data.items()
            ],
            key=lambda x: x["first_seen"],
        )

    # --- Compute personal bests ---
    print("Computing personal bests...")
    all_pbs = []
    profiles = {}

    for sid, results_list in swimmer_results.items():
        # Group by event key (stroke_distance_course)
        by_event = defaultdict(list)
        for r in results_list:
            ek = f"{r['stroke']}_{r['distance']}_{r['course']}"
            by_event[ek].append(r)

        pbs_lc = []
        pbs_sc = []
        for ek, times in by_event.items():
            best = min(times, key=lambda x: x["time_seconds"])
            pb = {
                "swimmer_id": sid,
                "event_key": ek,
                "distance": best["distance"],
                "stroke": best["stroke"],
                "course": best["course"],
                "time": best["time"],
                "time_seconds": best["time_seconds"],
                "competition_id": best["competition_id"],
                "date": best["date"],
                "age": best["age"],
            }
            all_pbs.append(pb)
            if best["course"] == "LC":
                pbs_lc.append(pb)
            else:
                pbs_sc.append(pb)

        # Sort PBs by distance then stroke
        pbs_lc.sort(key=lambda x: (x["distance"], x["stroke"]))
        pbs_sc.sort(key=lambda x: (x["distance"], x["stroke"]))

        # Dates
        all_dates = [r["date"] for r in results_list]
        all_comp_ids = set(r["competition_id"] for r in results_list)

        s = swimmers.get(sid, {})
        profiles[sid] = {
            "swimmer": s,
            "personal_bests": {"lc": pbs_lc, "sc": pbs_sc},
            "competition_count": len(all_comp_ids),
            "result_count": len(results_list),
            "last_competed": max(all_dates) if all_dates else "",
            "first_competed": min(all_dates) if all_dates else "",
        }

    # --- Write output ---
    print("Writing JSON files...")

    # Clean output dirs
    for subdir in ["results", "profiles"]:
        d = OUT_DIR / subdir
        d.mkdir(parents=True, exist_ok=True)

    # swimmers.json
    swimmer_list = sorted(swimmers.values(), key=lambda x: x["name_en"])
    with open(OUT_DIR / "swimmers.json", "w", encoding="utf-8") as f:
        json.dump(swimmer_list, f, ensure_ascii=False, indent=None, separators=(",", ":"))
    print(f"  swimmers.json: {len(swimmer_list)} swimmers")

    # clubs.json
    club_list = sorted(clubs.values(), key=lambda x: x["code"])
    with open(OUT_DIR / "clubs.json", "w", encoding="utf-8") as f:
        json.dump(club_list, f, ensure_ascii=False, indent=None, separators=(",", ":"))
    print(f"  clubs.json: {len(club_list)} clubs")

    # competitions.json
    comp_list = sorted(competitions.values(), key=lambda x: x["date"], reverse=True)
    with open(OUT_DIR / "competitions.json", "w", encoding="utf-8") as f:
        json.dump(comp_list, f, ensure_ascii=False, indent=None, separators=(",", ":"))
    print(f"  competitions.json: {len(comp_list)} competitions")

    # events.json
    event_list = sorted(events.values(), key=lambda x: (x["competition_id"], x["event_num"]))
    with open(OUT_DIR / "events.json", "w", encoding="utf-8") as f:
        json.dump(event_list, f, ensure_ascii=False, indent=None, separators=(",", ":"))
    print(f"  events.json: {len(event_list)} events")

    # results/{comp_id}.json
    for comp_id, comp_results in results_by_comp.items():
        with open(OUT_DIR / "results" / f"{comp_id}.json", "w", encoding="utf-8") as f:
            json.dump(comp_results, f, ensure_ascii=False, indent=None, separators=(",", ":"))
    print(f"  results/: {len(results_by_comp)} competition files")

    # profiles/{swimmer_id}.json
    written_profiles = 0
    for sid, profile in profiles.items():
        filename = sanitize_filename(sid) + ".json"
        with open(OUT_DIR / "profiles" / filename, "w", encoding="utf-8") as f:
            json.dump(profile, f, ensure_ascii=False, indent=None, separators=(",", ":"))
        written_profiles += 1
    print(f"  profiles/: {written_profiles} swimmer profiles")

    # personal_bests.json
    all_pbs.sort(key=lambda x: (x["event_key"], x["time_seconds"]))
    with open(OUT_DIR / "personal_bests.json", "w", encoding="utf-8") as f:
        json.dump(all_pbs, f, ensure_ascii=False, indent=None, separators=(",", ":"))
    print(f"  personal_bests.json: {len(all_pbs)} records")

    # search_index.json
    search_index = {
        "swimmers": [
            {"id": s["id"], "name": s["name_en"], "club": s["club_code"], "gender": s["gender"]}
            for s in swimmer_list
        ],
        "clubs": [
            {"code": c["code"], "name": c.get("name_en", c["code"])}
            for c in club_list
        ],
        "competitions": [
            {"id": c["id"], "name": c["name_en"], "date": c["date"], "course": c["course"]}
            for c in comp_list
        ],
    }
    with open(OUT_DIR / "search_index.json", "w", encoding="utf-8") as f:
        json.dump(search_index, f, ensure_ascii=False, indent=None, separators=(",", ":"))
    print(f"  search_index.json written")

    # Summary
    print(f"\n{'='*50}")
    print(f"DONE")
    print(f"{'='*50}")
    print(f"Swimmers:     {len(swimmer_list):,}")
    print(f"Clubs:        {len(club_list):,}")
    print(f"Competitions: {len(comp_list):,}")
    print(f"Events:       {len(event_list):,}")
    print(f"Results:      {sum(len(v) for v in results_by_comp.values()):,}")
    print(f"Personal Bests: {len(all_pbs):,}")
    print(f"Profiles:     {written_profiles:,}")


if __name__ == "__main__":
    main()
