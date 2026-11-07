#!/usr/bin/env python3
"""Validate local pages, assets, navigation, and editable data files."""

from __future__ import annotations

from html.parser import HTMLParser
import json
from pathlib import Path
import sys
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
PAGES = ["index.html", "research.html", "people.html", "publications.html", "news.html", "join.html"]
NAV_TARGETS = {"research.html", "people.html", "publications.html", "news.html", "join.html"}


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []
        self.sources: list[str] = []
        self.has_main = False
        self.has_skip = False
        self.title_seen = False
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "a" and values.get("href"):
            self.links.append(values["href"])
            if values["href"] == "#main-content":
                self.has_skip = True
        if tag in {"img", "script"} and values.get("src"):
            self.sources.append(values["src"])
        if tag == "link" and values.get("href"):
            self.sources.append(values["href"])
        if tag == "main" and values.get("id") == "main-content":
            self.has_main = True
        if tag == "title":
            self.in_title = True

    def handle_data(self, data):
        if self.in_title and data.strip():
            self.title_seen = True

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False


def local_target(value: str, page: Path) -> Path | None:
    parsed = urlparse(value)
    if parsed.scheme or parsed.netloc or value.startswith(('#', 'mailto:', 'tel:')):
        return None
    clean = parsed.path
    if not clean:
        return None
    return (page.parent / clean).resolve()


def main() -> int:
    errors: list[str] = []
    for page_name in PAGES:
        page = ROOT / page_name
        if not page.exists():
            errors.append(f"Missing page: {page_name}")
            continue
        parser = LinkParser()
        document = page.read_text(encoding="utf-8")
        parser.feed(document)
        if not parser.has_main or not parser.has_skip or not parser.title_seen:
            errors.append(f"{page_name}: missing title, main target, or skip link")
        nav_links = {link for link in parser.links if link in NAV_TARGETS}
        if nav_links != NAV_TARGETS:
            errors.append(f"{page_name}: incomplete primary navigation")
        for value in parser.links + parser.sources:
            target = local_target(value, page)
            if target and not target.exists():
                errors.append(f"{page_name}: broken local reference {value}")

    if (ROOT / "CNAME").read_text(encoding="utf-8").strip() != "beheralab.com":
        errors.append("CNAME must contain beheralab.com")

    people = json.loads((ROOT / "data" / "people.json").read_text(encoding="utf-8"))
    if len(people.get("groups", [])) != 3 or len(people.get("alumni", [])) < 1:
        errors.append("People data is missing required groups or alumni")

    publications = json.loads((ROOT / "data" / "publications.json").read_text(encoding="utf-8"))
    if not publications:
        errors.append("Publication data is empty")
    years = [int(item.get("year") or 0) for item in publications]
    if years != sorted(years, reverse=True):
        errors.append("Publications are not sorted newest-first")
    if len({item.get("id") for item in publications}) != len(publications):
        errors.append("Publication IDs are not unique")
    required = {"id", "title", "authors", "venue", "year", "url", "hidden"}
    for index, item in enumerate(publications):
        if not required.issubset(item):
            errors.append(f"Publication {index} is missing required fields")

    script = (ROOT / "assets" / "site.js").read_text(encoding="utf-8")
    if "item.hidden !== true" not in script:
        errors.append("Publication renderer does not omit hidden records")
    site_sources = [ROOT / name for name in PAGES]
    site_sources.extend(path for path in (ROOT / "assets").rglob("*") if path.is_file())
    site_text = "\n".join(path.read_text(encoding="utf-8", errors="ignore") for path in site_sources)
    if "growthCanvas" in site_text or "<canvas" in site_text:
        errors.append("Old atom animation code is still present")
    if "gradient" in site_text.casefold():
        errors.append("A gradient remains even though the design disallows gradients")

    if errors:
        print("Validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"Validated {len(PAGES)} pages, {len(publications)} publications, local assets, data, and CNAME.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
