#!/usr/bin/env python3
"""Refresh data/publications.json from a public Google Scholar profile.

The parser uses only Python's standard library. It writes atomically, preserves
local fields (especially ``hidden``), and refuses to replace the current file
with an empty or suspiciously short result.
"""

from __future__ import annotations

import argparse
import hashlib
import html
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urljoin, urlparse
from urllib.request import Request, urlopen


SCHOLAR_ID = "DFvG3aQAAAAJ"
PROFILE_URL = "https://scholar.google.com/citations"
DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "data" / "publications.json"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"
)
MANAGED_FIELDS = {"id", "title", "authors", "venue", "year", "url"}


def normalized_title(title: str) -> str:
    """Return a deterministic title key for matching and fallback IDs."""
    return re.sub(r"[^a-z0-9]+", " ", title.casefold()).strip()


def fallback_id(title: str) -> str:
    digest = hashlib.sha256(normalized_title(title).encode("utf-8")).hexdigest()[:16]
    return f"title:{digest}"


def scholar_id_from_url(url: str) -> str | None:
    value = parse_qs(urlparse(url).query).get("citation_for_view", [None])[0]
    return f"scholar:{value}" if value else None


class ScholarParser(HTMLParser):
    """Extract publication rows from a Google Scholar profile page."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.profile_name_seen = False
        self.records: list[dict[str, Any]] = []
        self.current: dict[str, Any] | None = None
        self.capture: str | None = None
        self.buffer: list[str] = []
        self.capturing_year = False
        self.year_buffer: list[str] = []
        self.gray_index = 0

    @staticmethod
    def _classes(attrs: list[tuple[str, str | None]]) -> set[str]:
        value = dict(attrs).get("class") or ""
        return set(value.split())

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        classes = self._classes(attrs)
        values = dict(attrs)
        if values.get("id") == "gsc_prf_in":
            self.profile_name_seen = True
        if tag == "tr" and "gsc_a_tr" in classes:
            self.current = {"title": "", "authors": "", "venue": "", "year": 0, "url": ""}
            self.gray_index = 0
            return
        if self.current is None:
            return
        if tag == "a" and "gsc_a_at" in classes:
            self.capture = "title"
            self.buffer = []
            self.current["url"] = urljoin("https://scholar.google.com", values.get("href") or "")
        elif tag == "div" and "gs_gray" in classes:
            self.capture = "authors" if self.gray_index == 0 else "venue"
            self.gray_index += 1
            self.buffer = []
        elif tag == "span" and "gsc_a_h" in classes:
            self.capturing_year = True
            self.year_buffer = []

    def handle_data(self, data: str) -> None:
        if self.capture:
            self.buffer.append(data)
        if self.capturing_year:
            self.year_buffer.append(data)

    def handle_endtag(self, tag: str) -> None:
        if self.current is None:
            return
        should_finish = (
            (tag == "a" and self.capture == "title")
            or (tag == "div" and self.capture in {"authors", "venue"})
        )
        if should_finish:
            value = " ".join("".join(self.buffer).split())
            self.current[self.capture] = value
            self.capture = None
            self.buffer = []
        if tag == "span" and self.capturing_year:
            value = " ".join("".join(self.year_buffer).split())
            if value.isdigit():
                self.current["year"] = int(value)
            self.capturing_year = False
            self.year_buffer = []
        if tag == "tr":
            title = str(self.current.get("title", "")).strip()
            if title:
                year = int(self.current.get("year") or 0)
                venue = re.sub(rf",?\s*{year}$", "", str(self.current.get("venue", ""))).strip()
                self.current["venue"] = venue
                stable_id = scholar_id_from_url(str(self.current.get("url", ""))) or fallback_id(title)
                self.current["id"] = stable_id
                self.records.append(self.current)
            self.current = None
            self.capture = None
            self.buffer = []
            self.capturing_year = False
            self.year_buffer = []


def parse_profile(document: str) -> tuple[bool, list[dict[str, Any]]]:
    parser = ScholarParser()
    parser.feed(document)
    return parser.profile_name_seen, parser.records


def fetch_page(start: int, timeout: int) -> str:
    query = urlencode(
        {
            "user": SCHOLAR_ID,
            "hl": "en",
            "oi": "ao",
            "cstart": start,
            "pagesize": 100,
            "sortby": "pubdate",
        }
    )
    request = Request(f"{PROFILE_URL}?{query}", headers={"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"})
    with urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise RuntimeError(f"Google Scholar returned HTTP {response.status}")
        return response.read().decode("utf-8", errors="replace")


def fetch_all(timeout: int) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for start in range(0, 1000, 100):
        if start:
            time.sleep(2)
        document = fetch_page(start, timeout)
        profile_seen, page_records = parse_profile(document)
        if start == 0 and not profile_seen:
            raise RuntimeError("The expected Scholar profile was not present; refusing to update data")
        if not page_records:
            if start == 0:
                raise RuntimeError("No publication rows were parsed; refusing to update data")
            break
        records.extend(page_records)
        if len(page_records) < 100:
            break
    return records


def load_existing(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, list):
        raise RuntimeError(f"{path} must contain a JSON array")
    return [item for item in value if isinstance(item, dict)]


def deduplicate(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen_ids: set[str] = set()
    seen_titles: set[str] = set()
    result: list[dict[str, Any]] = []
    for record in records:
        record_id = str(record.get("id") or fallback_id(str(record.get("title", ""))))
        title_key = normalized_title(str(record.get("title", "")))
        if record_id in seen_ids or (title_key and title_key in seen_titles):
            continue
        record["id"] = record_id
        seen_ids.add(record_id)
        if title_key:
            seen_titles.add(title_key)
        result.append(record)
    return result


def merge_records(remote: list[dict[str, Any]], existing: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_id = {str(item.get("id")): item for item in existing if item.get("id")}
    by_title = {normalized_title(str(item.get("title", ""))): item for item in existing if item.get("title")}
    merged: list[dict[str, Any]] = []
    matched_existing: set[str] = set()

    for fresh in deduplicate(remote):
        prior = by_id.get(str(fresh["id"])) or by_title.get(normalized_title(str(fresh["title"])))
        combined = dict(prior or {})
        combined.update({field: fresh.get(field) for field in MANAGED_FIELDS})
        combined["hidden"] = bool((prior or {}).get("hidden", False))
        merged.append(combined)
        if prior:
            matched_existing.add(str(prior.get("id", "")))

    # Scholar can temporarily omit rows. Keep unmatched local records so a brittle
    # upstream response cannot silently erase publications, including hidden ones.
    for prior in existing:
        if str(prior.get("id", "")) not in matched_existing:
            merged.append(prior)

    merged = deduplicate(merged)
    merged.sort(key=lambda item: (-int(item.get("year") or 0), str(item.get("title", "")).casefold()))
    return merged


def write_if_changed(path: Path, records: list[dict[str, Any]]) -> bool:
    if not records:
        raise RuntimeError("Refusing to write an empty publication list")
    rendered = json.dumps(records, indent=2, ensure_ascii=False) + "\n"
    if path.exists() and path.read_text(encoding="utf-8") == rendered:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix="publications-", suffix=".json", dir=path.parent)
    try:
        with os.fdopen(handle, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(rendered)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--source-file", type=Path, help="Parse a saved Scholar HTML file instead of making a request")
    parser.add_argument("--timeout", type=int, default=20)
    args = parser.parse_args()

    try:
        existing = load_existing(args.output)
        if args.source_file:
            document = args.source_file.read_text(encoding="utf-8")
            profile_seen, remote = parse_profile(document)
            if not profile_seen or not remote:
                raise RuntimeError("Saved HTML did not contain the expected profile and publications")
        else:
            remote = fetch_all(args.timeout)

        if existing and len(remote) < max(3, len(existing) // 3):
            raise RuntimeError(
                f"Parsed only {len(remote)} records versus {len(existing)} existing records; refusing a suspicious update"
            )
        merged = merge_records(remote, existing)
        changed = write_if_changed(args.output, merged)
        print(f"{'Updated' if changed else 'No changes to'} {args.output} ({len(merged)} publications)")
        return 0
    except (HTTPError, URLError, OSError, ValueError, RuntimeError, json.JSONDecodeError) as error:
        print(f"Publication sync failed safely: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
