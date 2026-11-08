#!/usr/bin/env python3
"""Validate local pages, assets, navigation, and editable data files."""

from __future__ import annotations

from html.parser import HTMLParser
import json
from pathlib import Path
import sys
from urllib.parse import urlparse
from xml.etree import ElementTree


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


class StaticYearParser(HTMLParser):
    """Detect empty publication year accordions if any are added to HTML."""

    def __init__(self) -> None:
        super().__init__()
        self.depth = 0
        self.current_items: int | None = None
        self.empty_groups = 0

    def handle_starttag(self, tag, attrs):
        classes = set((dict(attrs).get("class") or "").split())
        if self.current_items is not None:
            self.depth += 1
            if "publication-item" in classes:
                self.current_items += 1
        elif tag == "details" and "year-group" in classes:
            self.current_items = 0
            self.depth = 0

    def handle_endtag(self, tag):
        if self.current_items is None:
            return
        if self.depth == 0 and tag == "details":
            if self.current_items == 0:
                self.empty_groups += 1
            self.current_items = None
        else:
            self.depth = max(0, self.depth - 1)


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

    cname = ROOT / "CNAME"
    if not cname.exists() or cname.read_text(encoding="utf-8").strip() != "beheralab.com":
        errors.append("CNAME must contain beheralab.com")

    people = json.loads((ROOT / "data" / "people.json").read_text(encoding="utf-8"))
    if len(people.get("groups", [])) != 3 or len(people.get("alumni", [])) < 1:
        errors.append("People data is missing required groups or alumni")
    people_records = [people.get("principal_investigator", {})]
    people_records.extend(person for group in people.get("groups", []) for person in group.get("people", []))
    for person in people_records:
        image = person.get("image")
        if image and not (ROOT / image).exists():
            errors.append(f"Missing image for {person.get('name', 'person')}: {image}")

    publications = json.loads((ROOT / "data" / "publications.json").read_text(encoding="utf-8"))
    if not publications:
        errors.append("Publication data is empty")
    years = []
    for item in publications:
        try:
            years.append(int(item.get("year") or 0))
        except (TypeError, ValueError):
            years.append(0)
    if years != sorted(years, reverse=True):
        errors.append("Publications are not sorted newest-first")
    if len({item.get("id") for item in publications}) != len(publications):
        errors.append("Publication IDs are not unique")
    required = {"id", "title", "authors", "venue", "year", "url", "hidden"}
    for index, item in enumerate(publications):
        if not required.issubset(item):
            errors.append(f"Publication {index} is missing required fields")
        try:
            year = int(item.get("year") or 0)
        except (TypeError, ValueError):
            year = 0
        if item.get("hidden") is not True and year <= 0:
            errors.append(f"Visible publication has an invalid year: {item.get('title', index)}")
        if item.get("hidden") is True and not item.get("hidden_reason"):
            errors.append(f"Hidden publication is missing hidden_reason: {item.get('title', index)}")

    expected_hidden = {
        "Structure-Property Relations in the Polar Vortex System": "thesis",
        "Coherent Electric Field Manipulation of Single-Spins in Er 3-Doped PbTiO 3 Thin Films": "missing year",
        "Supporting Information for Interlayer coupling controlled ordering and phases in polar vortex superlattices": "supporting information",
        "Unleashing the Electromechanical Response of Ferroelastic Domain Reorganization in Mixed‐Phase Tetragonal Ferroelectric Multilayers (Adv. Mater. 19/2026)": "duplicate/cover entry",
    }
    by_title = {item.get("title"): item for item in publications}
    for title, reason in expected_hidden.items():
        item = by_title.get(title)
        if not item or item.get("hidden") is not True or item.get("hidden_reason") != reason:
            errors.append(f"Required editorial exclusion is missing or incorrect: {title}")
    for item in publications:
        if "APS March Meeting Abstracts" in str(item.get("venue", "")):
            if item.get("hidden") is not True or item.get("hidden_reason") != "conference abstract":
                errors.append(f"APS meeting abstract is not hidden correctly: {item.get('title')}")

    script = (ROOT / "assets" / "site.js").read_text(encoding="utf-8")
    if "item.hidden !== true" not in script:
        errors.append("Publication renderer does not omit hidden records")
    if 'String(publication.year || "Other")' in script or '"Other"' in script:
        errors.append("Publication renderer still creates an Other year group")
    if 'document.createElement("details")' not in script or 'document.createElement("summary")' not in script:
        errors.append("Publication renderer is missing native details/summary accordions")
    if "new Date().getFullYear()" not in script or "section.open = year === defaultOpenYear" not in script:
        errors.append("Publication renderer is missing future-proof default-open behavior")
    static_years = StaticYearParser()
    static_years.feed((ROOT / "publications.html").read_text(encoding="utf-8"))
    if static_years.empty_groups:
        errors.append("Publications HTML contains an empty static year section")

    lattice = ElementTree.parse(ROOT / "assets" / "lattice.svg").getroot()
    lattice_ids = {node.get("id") for node in lattice.iter() if node.get("id")}
    required_lattice_ids = {
        "free-atoms",
        "transition-atoms",
        "lattice",
        "device-layers",
        "interconnects",
    }
    if not required_lattice_ids.issubset(lattice_ids):
        errors.append("Lattice artwork is missing one or more required semantic groups")
    if any(node.tag.rsplit("}", 1)[-1] == "text" for node in lattice.iter()):
        errors.append("Lattice artwork must not contain visible text")

    site_sources = [ROOT / name for name in PAGES]
    site_sources.extend(path for path in (ROOT / "assets").rglob("*") if path.is_file())
    site_text = "\n".join(path.read_text(encoding="utf-8", errors="ignore") for path in site_sources)
    if "growthCanvas" in site_text or "<canvas" in site_text:
        errors.append("Old atom animation code is still present")
    if "gradient" in site_text.casefold():
        errors.append("A gradient remains even though the design disallows gradients")
    placeholder_labels = ("Figure forthcoming", "Headshot forthcoming", "portrait-placeholder")
    if any(label in site_text for label in placeholder_labels):
        errors.append("A public-facing placeholder remains in the site")

    if errors:
        print("Validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"Validated {len(PAGES)} pages, {len(publications)} publications, local assets, data, and CNAME.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
