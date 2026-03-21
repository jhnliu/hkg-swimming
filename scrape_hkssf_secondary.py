#!/usr/bin/env python3
"""Download all HKSSF secondary school swimming result PDFs."""

import os
import time
import requests
from urllib.parse import quote

BASE_URL = "https://www.hkssf-ext.org.hk/hkssf"
OUTPUT_DIR = "/Users/jhnl/hkg-swimming/data/pdf/hkssf_secondary"

os.makedirs(OUTPUT_DIR, exist_ok=True)

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
})

# All PDF paths extracted from the HKSSF results page
# Format: (relative_path, local_filename)
PDFS = []

# Division 1
for season in ["2425", "2324", "2223", "2122", "1920", "1819", "1718", "1617", "1516"]:
    PDFS.append(f"swimming/past results/{season} sw_results_d1.pdf")

# Division 2
for season in ["2425", "2324", "2223", "2122", "1920", "1819", "1718", "1617", "1516"]:
    PDFS.append(f"swimming/past results/{season} sw_results_d2.pdf")

# Division 3 (HK) - note: 1718, 1617, 1516 use "d3h" not "d3hk"
for season in ["2425", "2324", "2223", "2122", "1920", "1819"]:
    PDFS.append(f"swimming/past results/{season} sw_results_d3hk.pdf")
for season in ["1718", "1617", "1516"]:
    PDFS.append(f"swimming/past results/{season} sw_results_d3h.pdf")

# Division 3 (K1)
for season in ["2425", "2324", "2223", "2122", "1920", "1819", "1718", "1617", "1516"]:
    PDFS.append(f"swimming/past results/{season} sw_results_d3k1.pdf")

# Division 3 (K2)
for season in ["2425", "2324", "2223", "2122", "1920", "1819", "1718", "1617", "1516"]:
    PDFS.append(f"swimming/past results/{season} sw_results_d3k2.pdf")


def download_pdf(relative_path):
    """Download a single PDF."""
    filename = os.path.basename(relative_path)
    output_path = os.path.join(OUTPUT_DIR, filename)

    if os.path.exists(output_path):
        print(f"  SKIP (exists): {filename}")
        return True

    # URL-encode the path (spaces -> %20)
    encoded_path = quote(relative_path)
    url = f"{BASE_URL}/{encoded_path}"

    try:
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        with open(output_path, "wb") as f:
            f.write(resp.content)
        print(f"  OK: {filename} ({len(resp.content):,} bytes)")
        return True
    except requests.RequestException as e:
        print(f"  FAIL: {filename} - {e}")
        return False


if __name__ == "__main__":
    print(f"Downloading {len(PDFS)} PDFs to {OUTPUT_DIR}")
    success = 0
    fail = 0
    for path in PDFS:
        ok = download_pdf(path)
        if ok:
            success += 1
        else:
            fail += 1
        time.sleep(0.5)
    print(f"\nDone: {success} OK, {fail} failed")
