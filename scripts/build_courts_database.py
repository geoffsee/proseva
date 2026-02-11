#!/usr/bin/env python3
"""
# pipx run --spec pymupdf python3 scripts/build_courts_database.py /tmp/va-dist-courts.pdf static/va-courts.json
Extract Virginia District Courts from the vacourts.gov PDF directory.

Uses pymupdf (fitz) for PDF text extraction, which preserves column separation.

Usage:
  pipx run --spec pymupdf python3 get_courts.py [/path/to/dist.pdf] [/path/to/output.json]

If the PDF doesn't exist locally, it downloads from vacourts.gov.
"""

import json
import re
import sys
import urllib.request
from pathlib import Path

# -- Patterns --
RE_COURT_NAME = re.compile(
    r"^(.+?)\s+(GD & JDR|GD|JDR)$"
)
RE_JUDICIAL_DISTRICT = re.compile(r"^(.+\s+Judicial District)$")
RE_PHONE = re.compile(r"^(\d{3}[/\-]\d{3}[/\-]\d{4})$")
RE_LABELED_PHONE = re.compile(r"^(\w+):\s*(\d{3}[/\-]\d{3}[/\-]\d{4})$")
RE_FAX = re.compile(r"^Fax\s*-\s*(.+)$")
RE_CITY_STATE_ZIP = re.compile(r"^(.+?),\s*VA\s+(\d{5}(?:-\d{4})?)$")
RE_HOURS = re.compile(r"^Clerk'?s Office Hours:\s*(.+)$")
RE_HOMEPAGE = re.compile(r"^Homepage:(.+)$")
RE_EMAIL_LABELED = re.compile(r"^E-?Mail:\s*(\S+@\S+)$", re.IGNORECASE)
RE_EMAIL_BARE = re.compile(r"^\S+@vacourts\.gov$")
RE_EMAIL_LINE = re.compile(r"^email:\s*$", re.IGNORECASE)
RE_JUDGE = re.compile(r"^Hon\.\s+(.+)$")
RE_PAGE_HEADER = re.compile(
    r"^(COURT/DISTRICT/ADDRESS|JUDGE\(S\)|CLERK/CONTACT INFORMATION|"
    r"District Courts Directory|Page\s+\d+\s+of\s+\d+|\d{2}-\w{3}-\d{4}\s+\d{2}:\d{2}:\d{2})$"
)
RE_PO_BOX = re.compile(r"^P\.?\s*O\.?\s*Box\s+\d+", re.IGNORECASE)
RE_PHYSICAL_ADDR = re.compile(r"^Physical Address:\s*(.*)$", re.IGNORECASE)
RE_MAILING_ADDR = re.compile(r"^Mailing Address:\s*(.*)$", re.IGNORECASE)


COURT_TYPES = {
    "GD": "General District",
    "JDR": "Juvenile & Domestic Relations",
    "GD & JDR": "Combined District",
}


def extract_text(pdf_path: Path) -> str:
    """Extract text from PDF using pymupdf."""
    import fitz
    doc = fitz.open(str(pdf_path))
    pages = []
    for page in doc:
        pages.append(page.get_text())
    return "\n".join(pages)


def split_into_blocks(text: str) -> list[list[str]]:
    """Split text into court blocks, each ending at a Homepage: line."""
    blocks = []
    current = []

    for raw_line in text.splitlines():
        line = raw_line.strip()

        # Skip page headers/footers
        if RE_PAGE_HEADER.match(line):
            continue

        # Skip empty lines
        if not line:
            continue

        current.append(line)

        # Homepage marks end of block
        if RE_HOMEPAGE.match(line):
            blocks.append(current)
            current = []

    return blocks


def parse_block(lines: list[str]) -> dict | None:
    """Parse a court block into a structured dict."""
    if not lines:
        return None

    # First line should be court name
    m = RE_COURT_NAME.match(lines[0])
    if not m:
        return None

    locality = m.group(1).strip()
    court_code = m.group(2).strip()
    court_type = COURT_TYPES.get(court_code, court_code)

    court = {
        "name": f"{locality} {court_code}",
        "locality": locality,
        "type": court_type,
        "district": None,
        "clerk": None,
        "phone": None,
        "phones": {},
        "fax": None,
        "email": None,
        "address": [],
        "city": None,
        "state": "VA",
        "zip": None,
        "hours": None,
        "homepage": None,
        "judges": [],
    }

    expect_email_next = False

    for line in lines[1:]:
        # Judicial district
        m = RE_JUDICIAL_DISTRICT.match(line)
        if m:
            court["district"] = m.group(1)
            continue

        # Homepage
        m = RE_HOMEPAGE.match(line)
        if m:
            court["homepage"] = m.group(1).strip()
            continue

        # Hours
        m = RE_HOURS.match(line)
        if m:
            court["hours"] = m.group(1).strip()
            continue

        # Fax
        m = RE_FAX.match(line)
        if m:
            court["fax"] = m.group(1).strip()
            continue

        # Labeled phone (Traffic:, Criminal:, Civil:)
        m = RE_LABELED_PHONE.match(line)
        if m:
            label = m.group(1)
            number = m.group(2)
            court["phones"][label] = number
            if not court["phone"]:
                court["phone"] = number
            continue

        # Plain phone
        m = RE_PHONE.match(line)
        if m:
            if not court["phone"]:
                court["phone"] = m.group(1)
            else:
                court["phones"]["other"] = m.group(1)
            continue

        # Email labeled (E-Mail: foo@bar)
        m = RE_EMAIL_LABELED.match(line)
        if m:
            court["email"] = m.group(1).strip()
            expect_email_next = False
            continue

        # "email:" on its own line — next non-blank might be the address
        if RE_EMAIL_LINE.match(line):
            expect_email_next = True
            continue

        # Bare email (foo@vacourts.gov)
        if RE_EMAIL_BARE.match(line):
            court["email"] = line.strip()
            expect_email_next = False
            continue

        # If we were expecting an email after "email:" line
        if expect_email_next and "@" in line:
            court["email"] = line.strip()
            expect_email_next = False
            continue

        expect_email_next = False

        # Judge
        m = RE_JUDGE.match(line)
        if m:
            court["judges"].append(m.group(1).strip())
            continue

        # City, State Zip
        m = RE_CITY_STATE_ZIP.match(line)
        if m:
            court["city"] = m.group(1).strip()
            court["zip"] = m.group(2).strip()
            continue

        # Clerk — typically the second line (right after court name),
        # before any Hon./district/phone. Detect by position: if we
        # don't have a clerk yet and this doesn't match other patterns,
        # and we haven't seen district yet, it's probably the clerk.
        if (
            court["clerk"] is None
            and court["district"] is None
            and not RE_PO_BOX.match(line)
        ):
            court["clerk"] = line
            continue

        # Address lines (street, PO box, suite, etc.)
        if (
            RE_PO_BOX.match(line)
            or re.match(r"^\d+\s+", line)  # starts with street number
            or "Street" in line
            or "Avenue" in line
            or "Road" in line
            or "Blvd" in line
            or "Drive" in line
            or "Suite" in line
            or "Floor" in line
            or "Courthouse" in line
            or "Mall" in line
            or "Center" in line
            or "Plaza" in line
            or "Building" in line
            or "Rd." in line
            or "St." in line
            or "Ave." in line
        ):
            court["address"].append(line)
            continue

        # Physical / Mailing address
        m = RE_PHYSICAL_ADDR.match(line) or RE_MAILING_ADDR.match(line)
        if m:
            addr = m.group(1).strip()
            if addr:
                court["address"].append(line)
            continue

    # Clean up phones dict
    if not court["phones"]:
        del court["phones"]
    if not court["email"]:
        court["email"] = None
    if not court["address"]:
        court["address"] = None
    else:
        court["address"] = ", ".join(court["address"])

    return court


def main():
    pdf_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/va-dist-courts.pdf")
    pdf_path = pdf_path.expanduser().resolve()

    out_path = (
        Path(sys.argv[2]).expanduser().resolve()
        if len(sys.argv) >= 3
        else Path("static/va-courts.json")
    )

    if not pdf_path.exists():
        print(f"Downloading PDF to {pdf_path}...")
        urllib.request.urlretrieve(
            "https://www.vacourts.gov/static/directories/dist.pdf",
            str(pdf_path),
        )

    print(f"Extracting text from {pdf_path}...")
    text = extract_text(pdf_path)

    blocks = split_into_blocks(text)
    print(f"Found {len(blocks)} court blocks")

    courts = []
    for block in blocks:
        court = parse_block(block)
        if court:
            courts.append(court)

    out_path.write_text(json.dumps(courts, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(courts)} courts -> {out_path}")


if __name__ == "__main__":
    main()
