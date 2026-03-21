#!/usr/bin/env python3
"""Download all club directory PDFs from HKGSA website and extract club data."""

import urllib.request
import base64
import json
import os
import pdfplumber
import re
import csv

# PDF URLs mapped by year (base64-encoded file paths from the website)
YEAR_PDFS = {
    "2025-26": "dXBsb2FkL3RlbXBsYXRlLzQ5NTcvcGRmX2ZpbGVzXzIvNjlhZmRkNTdkMmQzNi5wZGY=",
    "2024-25": "dXBsb2FkL3RlbXBsYXRlLzQ1ODMvcGRmX2ZpbGVzXzIvNjdjNTU2NzA3YTc5Yy5wZGY=",
    "2023-24": "dXBsb2FkL3RlbXBsYXRlLzQxNTMvcGRmX2ZpbGVzXzIvNjQ1ODcwNzYzNjc1ZC5wZGY=",
    "2022-23": "dXBsb2FkL3RlbXBsYXRlLzM1NTQvcGRmX2ZpbGVzXzIvNjI0ZmFjNDdhYWEwNS5wZGY=",
    "2021-22": "dXBsb2FkL3RlbXBsYXRlLzMxMTcvcGRmX2ZpbGVzXzIvNjBkYWNhNDdkMjY2Yy5wZGY=",
    "2020-21": "dXBsb2FkL3RlbXBsYXRlLzIyODkvcGRmX2ZpbGVzXzIvNjAwN2NiMDA0MGQwZS5wZGY=",
    "2019-20": "dXBsb2FkL3RlbXBsYXRlLzIxNTAvcGRmX2ZpbGVzXzIvNTIzMDU2Y2U0MTUwNmFlMGI1OTM3OTcwMzU4OWVkYTMucGRm",
    "2018-19": "dXBsb2FkL3RlbXBsYXRlLzIxNDkvcGRmX2ZpbGVzXzIvODRmN2NiM2MyNDYwYjRmOGIzMzViMTM3YWYyMGMyYmQucGRm",
    "2017-18": "dXBsb2FkL3RlbXBsYXRlLzIxNDgvcGRmX2ZpbGVzXzIvMDUzZjBmMmY4OTYzNGVjM2VhYjQxYWJjMjA0NDE1ZTkucGRm",
    "2016-17": "dXBsb2FkL3RlbXBsYXRlLzIxNDcvcGRmX2ZpbGVzXzIvYzY3YzhmYjA0MjIwM2IwM2Y5MThkY2VhN2ZhYmRjYzAucGRm",
    "2015-16": "dXBsb2FkL3RlbXBsYXRlLzIxNDYvcGRmX2ZpbGVzXzIvZDNjZjY1YzlkZmUwZWNiYjg2YWMyZTNlZTkxMjFlYjIucGRm",
}

BASE_URL = "https://hkgswimming.org.hk/zh-hant/savefile/?file="
PDF_DIR = os.path.join("data", "pdf", "clubs")


def download_pdfs():
    """Download all PDFs if not already downloaded."""
    os.makedirs(PDF_DIR, exist_ok=True)
    for year, file_param in YEAR_PDFS.items():
        pdf_path = os.path.join(PDF_DIR, f"clubs_{year}.pdf")
        if os.path.exists(pdf_path):
            print(f"  Already have {year}")
            continue
        url = BASE_URL + file_param
        print(f"  Downloading {year}...")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
                with open(pdf_path, "wb") as f:
                    f.write(data)
                print(f"    Saved {len(data)} bytes")
        except Exception as e:
            print(f"    Error: {e}")


def extract_clubs_from_pdf(pdf_path, year):
    """Extract club data from a single PDF."""
    clubs = []
    current_section = None

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            text = page.extract_text() or ""

            # Detect section from page text
            if "Full Members" in text or "正式屬會名錄" in text:
                if "Designated Venue-Based" in text or "駐池泳會" in text:
                    current_section = "Full Member (Venue-Based)"
                else:
                    current_section = "Full Member"
            elif "Observer Member" in text or "觀察屬會" in text:
                current_section = "Observer Member"
            elif "Competition Member" in text or "競賽屬會" in text:
                current_section = "Competition Member"

            # Extract tables
            tables = page.extract_tables()
            for table in tables:
                if not table:
                    continue
                for row in table:
                    if not row or len(row) < 3:
                        continue
                    # Skip header rows
                    first_cell = (row[0] or "").strip()
                    if first_cell in ("Club Code", "Code of Club", "Club code", "Code of club", ""):
                        # Check if it's truly a header
                        second_cell = (row[1] or "").strip() if len(row) > 1 else ""
                        if second_cell in ("Name of Member", "Name of member", "Name of club", "Name of Club"):
                            continue
                    if not first_cell or first_cell.startswith("Full Member") or first_cell.startswith("Observer") or first_cell.startswith("Competition"):
                        continue

                    club = {
                        "year": year,
                        "club_code": first_cell.lstrip("#"),
                        "name_en": (row[1] or "").strip() if len(row) > 1 else "",
                        "name_zh": (row[2] or "").strip() if len(row) > 2 else "",
                        "contact_person": (row[3] or "").strip() if len(row) > 3 else "",
                        "phone": (row[4] or "").strip() if len(row) > 4 else "",
                        "email": (row[5] or "").strip() if len(row) > 5 else "",
                        "membership_type": current_section or "Unknown",
                    }

                    # Validate - must have a reasonable club code
                    if club["club_code"] and len(club["club_code"]) <= 5:
                        clubs.append(club)

    return clubs


def main():
    print("Downloading club directory PDFs...")
    download_pdfs()

    print("\nExtracting club data from PDFs...")
    all_clubs = []
    for year in sorted(YEAR_PDFS.keys(), reverse=True):
        pdf_path = os.path.join(PDF_DIR, f"clubs_{year}.pdf")
        if not os.path.exists(pdf_path):
            print(f"  Skipping {year} - PDF not found")
            continue
        print(f"  Processing {year}...")
        try:
            clubs = extract_clubs_from_pdf(pdf_path, year)
            print(f"    Found {len(clubs)} clubs")
            all_clubs.extend(clubs)
        except Exception as e:
            print(f"    Error: {e}")
            import traceback
            traceback.print_exc()

    print(f"\nTotal clubs across all years: {len(all_clubs)}")

    # Save as JSON
    json_dir = os.path.join("data", "json", "clubs")
    os.makedirs(json_dir, exist_ok=True)
    output_json = os.path.join(json_dir, "clubs.json")
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(all_clubs, f, ensure_ascii=False, indent=2)
    print(f"Saved to {output_json}")

    # Save as CSV
    csv_dir = os.path.join("data", "csv", "clubs")
    os.makedirs(csv_dir, exist_ok=True)
    output_csv = os.path.join(csv_dir, "clubs.csv")
    if all_clubs:
        fieldnames = ["year", "club_code", "name_en", "name_zh", "contact_person", "phone", "email", "membership_type"]
        with open(output_csv, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(all_clubs)
        print(f"Saved to {output_csv}")

    # Print summary
    years = sorted(set(c["year"] for c in all_clubs), reverse=True)
    for year in years:
        year_clubs = [c for c in all_clubs if c["year"] == year]
        types = {}
        for c in year_clubs:
            types[c["membership_type"]] = types.get(c["membership_type"], 0) + 1
        type_str = ", ".join(f"{t}: {n}" for t, n in sorted(types.items()))
        print(f"  {year}: {len(year_clubs)} clubs ({type_str})")


if __name__ == "__main__":
    main()
