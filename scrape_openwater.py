#!/usr/bin/env python3
"""Scrape open water swimming competition result PDFs from hkgswimming.org.hk"""

import os
import re
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

BASE_URL = "https://hkgswimming.org.hk"
INDEX_URL = f"{BASE_URL}/zh-hant/activities/134/"
OUTPUT_DIR = "/Users/jhnl/hkg-swimming/data/pdf/openwater"

os.makedirs(OUTPUT_DIR, exist_ok=True)

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
})


def get_event_links():
    """Get all open water event sub-page links from the index page."""
    resp = session.get(INDEX_URL, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    links = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        match = re.match(r"/zh-hant/activities/(\d+)/", href)
        if not match:
            continue
        eid = match.group(1)
        text = a.get_text(strip=True)
        # Open water events have year patterns and "公開水域" or "更多"
        # Filter to the "更多" links which point to actual event pages
        if text == "更多" and eid not in seen:
            seen.add(eid)
            links.append({
                "id": eid,
                "url": urljoin(BASE_URL, href),
            })

    return links


def get_event_title_and_pdfs(event_url):
    """Get the title and PDF links from an event page."""
    resp = session.get(event_url, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True).split(" - ")[0] if title_tag else ""

    pdf_links = []
    for a in soup.find_all("a", href=True):
        if "savefile" in a["href"]:
            full_url = urljoin(BASE_URL, a["href"])
            if full_url not in pdf_links:
                pdf_links.append(full_url)

    return title, pdf_links


def sanitize_filename(name):
    """Make a safe filename."""
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    name = re.sub(r'\s+', ' ', name).strip()
    if len(name) > 120:
        name = name[:120]
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
    print("Fetching open water event list...")
    events = get_event_links()
    print(f"Found {len(events)} events")

    total = 0
    failed = []

    for i, event in enumerate(events):
        print(f"\n[{i+1}/{len(events)}] Event {event['id']}")

        try:
            title, pdf_links = get_event_title_and_pdfs(event["url"])
            print(f"  Title: {title}")

            if not pdf_links:
                print("  No PDFs found")
                continue

            for j, pdf_url in enumerate(pdf_links):
                suffix = f"_{j+1}" if len(pdf_links) > 1 else ""
                filename = f"{event['id']}_{sanitize_filename(title)}{suffix}.pdf"
                filepath = os.path.join(OUTPUT_DIR, filename)

                if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
                    print(f"  Already exists: {filename}")
                    total += 1
                    continue

                print(f"  Downloading...")
                try:
                    size = download_pdf(pdf_url, filepath)
                    print(f"  Saved: {filename} ({size:,} bytes)")
                    total += 1
                except Exception as e:
                    print(f"  Failed: {e}")
                    failed.append((event["id"], str(e)))

            time.sleep(0.3)

        except Exception as e:
            print(f"  Error: {e}")
            failed.append((event["id"], str(e)))

    print(f"\n{'='*60}")
    print(f"Total PDFs: {total}")
    print(f"Failed: {len(failed)}")
    if failed:
        for eid, err in failed:
            print(f"  - {eid}: {err}")


if __name__ == "__main__":
    main()
