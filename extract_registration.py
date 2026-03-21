#!/usr/bin/env python3
"""Extract athlete registration data from HKGSA registration PDFs."""

import pdfplumber
import csv
import os
import re

DATA_DIR = "data/registration"
OUTPUT_DIR = "data/registration"


def extract_registration_pdf(pdf_path):
    """Extract rows from a registration PDF."""
    rows = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    if not row or not row[0]:
                        continue
                    # Skip header rows
                    if row[0].strip() in ("Reg No.", "Reg No"):
                        continue
                    # Clean cells
                    cleaned = [cell.strip() if cell else "" for cell in row]
                    # Validate: first column should look like a reg number
                    if re.match(r"^\d", cleaned[0]):
                        rows.append(cleaned)
    return rows


def main():
    pdf_files = sorted(
        f for f in os.listdir(DATA_DIR) if f.endswith(".pdf")
    )

    for pdf_file in pdf_files:
        pdf_path = os.path.join(DATA_DIR, pdf_file)
        csv_file = pdf_file.replace(".pdf", ".csv")
        csv_path = os.path.join(OUTPUT_DIR, csv_file)

        print(f"Processing {pdf_file}...")
        rows = extract_registration_pdf(pdf_path)
        print(f"  Extracted {len(rows)} athletes")

        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["reg_no", "last_name", "first_name", "club"])
            for row in rows:
                # Some PDFs might have extra columns, take first 4
                writer.writerow(row[:4])

        print(f"  Saved to {csv_file}")


if __name__ == "__main__":
    main()
