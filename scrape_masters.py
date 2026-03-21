#!/usr/bin/env python3
"""Scrape all Masters (Advanced) swimming competition result PDFs from hkgswimming.org.hk"""

import os
import re
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

BASE_URL = "https://hkgswimming.org.hk"
OUTPUT_DIR = "/Users/jhnl/hkg-swimming/data/pdf/masters"

# Three categories of Masters results, each with season sub-pages
INDEX_PAGES = {
    "lcm_champs": {
        "url": f"{BASE_URL}/zh-hant/activities/2394/",
        "label": "LCM Championships",
    },
    "lcm": {
        "url": f"{BASE_URL}/zh-hant/activities/2391/",
        "label": "LCM",
    },
    "scm": {
        "url": f"{BASE_URL}/zh-hant/activities/2393/",
        "label": "SCM",
    },
}

os.makedirs(OUTPUT_DIR, exist_ok=True)

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
})


def get_season_links(index_url):
    """Get all season sub-page links from an index page."""
    resp = session.get(index_url, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        match = re.match(r"/zh-hant/activities/(\d+)/", href)
        if match:
            activity_id = match.group(1)
            text = a.get_text(strip=True)
            # Season links have year patterns like "2024-2025"
            if re.search(r"20\d{2}-20\d{2}", text):
                full_url = urljoin(BASE_URL, href)
                if full_url not in [l["url"] for l in links]:
                    links.append({
                        "id": activity_id,
                        "season": text.strip(),
                        "url": full_url,
                    })

    return links


def get_pdf_links_from_page(page_url):
    """Get all PDF savefile links from a page. Returns list of (url, label) tuples."""
    resp = session.get(page_url, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    pdf_links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "savefile" in href:
            full_url = urljoin(BASE_URL, href)
            label = a.get_text(strip=True) or "results"
            if full_url not in [p[0] for p in pdf_links]:
                pdf_links.append((full_url, label))

    return pdf_links


def sanitize_filename(name):
    """Make a safe filename."""
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    name = re.sub(r'\s+', '_', name).strip('_')
    if len(name) > 100:
        name = name[:100]
    return name


def download_pdf(url, filepath):
    """Download a PDF file."""
    resp = session.get(url, timeout=60, stream=True)
    resp.raise_for_status()

    with open(filepath, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)

    return os.path.getsize(filepath)


def main():
    total_pdfs = 0
    failed = []

    for category_key, category in INDEX_PAGES.items():
        print(f"\n{'='*60}")
        print(f"Category: {category['label']}")
        print(f"{'='*60}")

        # Step 1: Get season sub-pages from the index
        print(f"Fetching index: {category['url']}")
        try:
            seasons = get_season_links(category["url"])
        except Exception as e:
            print(f"  Error fetching index: {e}")
            continue

        print(f"  Found {len(seasons)} seasons: {[s['season'] for s in seasons]}")

        # Step 2: Visit each season page and download PDFs
        for season in seasons:
            print(f"\n  [{season['season']}] {season['url']}")

            try:
                pdf_links = get_pdf_links_from_page(season["url"])

                if not pdf_links:
                    print(f"    No PDFs found")
                    continue

                print(f"    Found {len(pdf_links)} PDF(s)")

                for j, (pdf_url, label) in enumerate(pdf_links):
                    suffix = f"_{j+1}" if len(pdf_links) > 1 else ""
                    filename = f"{season['id']}_{category_key}_{sanitize_filename(season['season'])}{suffix}.pdf"
                    filepath = os.path.join(OUTPUT_DIR, filename)

                    if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
                        print(f"    Already exists: {filename}")
                        total_pdfs += 1
                        continue

                    print(f"    Downloading: {label}...")
                    try:
                        size = download_pdf(pdf_url, filepath)
                        print(f"    Saved: {filename} ({size:,} bytes)")
                        total_pdfs += 1
                    except Exception as e:
                        print(f"    Failed: {e}")
                        failed.append((category['label'], season['season'], pdf_url, str(e)))

                time.sleep(0.3)

            except Exception as e:
                print(f"    Error: {e}")
                failed.append((category['label'], season['season'], None, str(e)))
                time.sleep(1)

    # Summary
    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"Total PDFs downloaded: {total_pdfs}")
    print(f"Failed downloads: {len(failed)}")

    if failed:
        print(f"\nFailed downloads:")
        for cat, season, url, err in failed:
            print(f"  - {cat} / {season}: {err}")


if __name__ == "__main__":
    main()
