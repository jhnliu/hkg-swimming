#!/usr/bin/env python3
"""Scrape district age-group swimming competition results from LCSD.

Source: https://www.lcsd.gov.hk/clpss/tc/webApp/Dagc.do
Downloads result PDFs and best-record PDFs for all 18 districts.
Covers current season + last year's results.
"""

import os
import re
import time
import requests
from bs4 import BeautifulSoup

SEARCH_URL = "https://www.lcsd.gov.hk/clpss/tc/search/common/searchResult.do"
LAST_YEAR_URL = "https://www.lcsd.gov.hk/clpss/tc/webApp/DagcLast.do?type=last_result"
OUTPUT_DIR = "/Users/jhnl/hkg-swimming/data/pdf/regional"

os.makedirs(OUTPUT_DIR, exist_ok=True)

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
})

DISTRICT_MAP = {
    "東區": "eastern",
    "灣仔": "wanchai",
    "中西區": "central_western",
    "南區": "southern",
    "油尖旺": "ytm",
    "深水埗": "ssp",
    "九龍城": "kowloon_city",
    "黃大仙": "wts",
    "觀塘": "kwun_tong",
    "沙田": "shatin",
    "西貢": "sai_kung",
    "屯門": "tuen_mun",
    "葵青": "kwai_tsing",
    "元朗": "yuen_long",
    "北區": "north",
    "大埔": "tai_po",
    "荃灣": "tsuen_wan",
    "離島": "islands",
}


def extract_year_from_date(date_str):
    """Extract the year from a date string like '02/11/2025 - 02/11/2025(日)'."""
    m = re.search(r"(\d{4})", date_str)
    return m.group(1) if m else "unknown"


def parse_swimming_rows(soup):
    """Extract swimming competition rows from a results page/table.

    Returns list of dicts with district, date, result_url, record_url.
    """
    entries = []
    tables = soup.find_all("table", class_="resultTable")
    if not tables:
        tables = soup.find_all("table")

    for table in tables:
        rows = table.find_all("tr")
        for row in rows:
            cells = row.find_all("td")
            if len(cells) < 4:
                continue

            activity = cells[0].get_text(strip=True)
            if "游泳" not in activity:
                continue

            district = cells[1].get_text(strip=True)
            date = cells[2].get_text(strip=True)

            links = [a.get("href") for a in row.find_all("a", href=True) if ".pdf" in a.get("href", "").lower()]

            result_url = None
            record_url = None
            for link in links:
                if "_res_" in link:
                    result_url = link
                elif "_rec_" in link:
                    record_url = link

            if result_url or record_url:
                entries.append({
                    "district": district,
                    "district_en": DISTRICT_MAP.get(district, district),
                    "date": date,
                    "year": extract_year_from_date(date),
                    "result_url": result_url,
                    "record_url": record_url,
                })

    return entries


def get_current_season():
    """Fetch current season swimming results from the LCSD search API."""
    resp = session.post(SEARCH_URL, data={
        "searchFormPath": "/webApp/Dagc",
        "act": "007",
        "dist": "ALL",
        "pageNo": "1",
        "sortField": "",
        "sortOrder": "",
    }, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    return parse_swimming_rows(soup)


def get_last_year():
    """Fetch last year's swimming results."""
    resp = session.get(LAST_YEAR_URL, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    return parse_swimming_rows(soup)


def download_pdf(url, filepath):
    """Download a PDF file."""
    resp = session.get(url, timeout=60, stream=True)
    resp.raise_for_status()

    with open(filepath, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)

    return os.path.getsize(filepath)


def main():
    print("Fetching current season...")
    current = get_current_season()
    print(f"  Found {len(current)} districts")

    print("Fetching last year's results...")
    last_year = get_last_year()
    print(f"  Found {len(last_year)} districts")

    # Deduplicate by URL
    seen_urls = set()
    all_entries = []
    for entry in current + last_year:
        key = entry["result_url"] or entry["record_url"]
        if key and key not in seen_urls:
            seen_urls.add(key)
            if entry["result_url"]:
                seen_urls.add(entry["result_url"])
            if entry["record_url"]:
                seen_urls.add(entry["record_url"])
            all_entries.append(entry)

    print(f"\nTotal unique entries: {len(all_entries)}")

    total_downloaded = 0
    skipped = 0
    failed = []

    for entry in all_entries:
        district = entry["district"]
        year = entry["year"]
        dist_en = entry["district_en"]

        for label, url in [("results", entry["result_url"]), ("records", entry["record_url"])]:
            if not url:
                continue

            filename = f"{year}_{dist_en}_{label}.pdf"
            filepath = os.path.join(OUTPUT_DIR, filename)

            if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
                skipped += 1
                continue

            print(f"  Downloading {district} {year} {label}...")
            try:
                size = download_pdf(url, filepath)
                print(f"    Saved: {filename} ({size:,} bytes)")
                total_downloaded += 1
            except Exception as e:
                print(f"    Failed: {e}")
                failed.append((filename, str(e)))

            time.sleep(0.3)

    # Summary
    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"New PDFs downloaded: {total_downloaded}")
    print(f"Already existed: {skipped}")
    print(f"Failed: {len(failed)}")

    if failed:
        print(f"\nFailed downloads:")
        for name, err in failed:
            print(f"  - {name}: {err}")


if __name__ == "__main__":
    main()
