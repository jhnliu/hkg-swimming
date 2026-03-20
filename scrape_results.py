#!/usr/bin/env python3
"""Scrape all swimming competition result PDFs from hkgswimming.org.hk"""

import os
import re
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

BASE_URL = "https://hkgswimming.org.hk"
LIST_URL = f"{BASE_URL}/zh-hant/activities/16/"
OUTPUT_DIR = "/Users/jhnl/hkg-swimming/results_pdfs"
TOTAL_PAGES = 12

os.makedirs(OUTPUT_DIR, exist_ok=True)

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
})


def get_event_links_from_page(page_num):
    """Get all event links from a listing page using the download2-list container."""
    params = {"page": page_num}
    resp = session.get(LIST_URL, params=params, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    container = soup.find("div", class_="download2-list")
    if not container:
        return []

    links = []
    for a in container.find_all("a", class_="download-item", href=True):
        href = a["href"]
        match = re.match(r"/zh-hant/activities/(\d+)/", href)
        if match:
            event_id = match.group(1)
            title_div = a.find("div", class_="download-title")
            title = title_div.get_text(strip=True) if title_div else f"event_{event_id}"
            links.append({
                "id": event_id,
                "title": title,
                "url": urljoin(BASE_URL, href)
            })

    return links


def get_pdf_links_from_event(event_url):
    """Get all PDF savefile links from an event page."""
    resp = session.get(event_url, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    pdf_links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "savefile" in href:
            full_url = urljoin(BASE_URL, href)
            if full_url not in pdf_links:
                pdf_links.append(full_url)

    return pdf_links


def sanitize_filename(name):
    """Make a safe filename from event title."""
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
    # Step 1: Collect all event links from all 12 pages
    all_events = []

    for page in range(1, TOTAL_PAGES + 1):
        print(f"Fetching event list page {page}/{TOTAL_PAGES}...")
        try:
            events = get_event_links_from_page(page)
            print(f"  Found {len(events)} events")
            all_events.extend(events)
        except Exception as e:
            print(f"  Error on page {page}: {e}")
        time.sleep(0.5)

    # Deduplicate by event id
    seen_ids = set()
    unique_events = []
    for ev in all_events:
        if ev["id"] not in seen_ids:
            seen_ids.add(ev["id"])
            unique_events.append(ev)

    print(f"\nTotal unique events: {len(unique_events)}")

    # Step 2: Visit each event page and download PDFs
    total_pdfs = 0
    failed = []
    no_pdf = []

    for i, event in enumerate(unique_events):
        print(f"\n[{i+1}/{len(unique_events)}] {event['title']} (ID: {event['id']})")

        try:
            pdf_links = get_pdf_links_from_event(event["url"])

            if not pdf_links:
                print("  No PDF found")
                no_pdf.append(event)
                continue

            for j, pdf_url in enumerate(pdf_links):
                suffix = f"_{j+1}" if len(pdf_links) > 1 else ""
                filename = f"{event['id']}_{sanitize_filename(event['title'])}{suffix}.pdf"
                filepath = os.path.join(OUTPUT_DIR, filename)

                if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
                    print(f"  Already exists: {filename}")
                    total_pdfs += 1
                    continue

                print(f"  Downloading PDF {j+1}/{len(pdf_links)}...")
                try:
                    size = download_pdf(pdf_url, filepath)
                    print(f"  Saved: {filename} ({size:,} bytes)")
                    total_pdfs += 1
                except Exception as e:
                    print(f"  Failed to download: {e}")
                    failed.append((event, pdf_url, str(e)))

            time.sleep(0.3)

        except Exception as e:
            print(f"  Error: {e}")
            failed.append((event, None, str(e)))
            time.sleep(1)

    # Summary
    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"Total events: {len(unique_events)}")
    print(f"PDFs downloaded: {total_pdfs}")
    print(f"Events with no PDF: {len(no_pdf)}")
    print(f"Failed downloads: {len(failed)}")

    if no_pdf:
        print(f"\nEvents with no PDF:")
        for ev in no_pdf:
            print(f"  - {ev['title']} (ID: {ev['id']})")

    if failed:
        print(f"\nFailed downloads:")
        for ev, url, err in failed:
            print(f"  - {ev['title']} (ID: {ev['id']}): {err}")


if __name__ == "__main__":
    main()
