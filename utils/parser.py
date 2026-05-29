"""
Parses NotebookLM's formatted text response into structured incident dicts.
"""

import re
from typing import Optional


def parse_response(text: str, category: str, access_tier_default: int = 1) -> list[dict]:
    """
    Parse NotebookLM response text into a list of incident dicts.
    Returns empty list if no incidents found.
    """
    if not text or "NO_INCIDENTS_FOUND" in text:
        return []

    # Split on INCIDENT markers
    incident_blocks = re.split(r"INCIDENT\s+\[\d+\]", text, flags=re.IGNORECASE)

    incidents = []
    for block in incident_blocks:
        block = block.strip()
        if not block:
            continue
        inc = parse_incident_block(block, category, access_tier_default)
        if inc and inc.get("description"):
            incidents.append(inc)

    return incidents


def parse_incident_block(block: str, category: str, access_tier_default: int) -> Optional[dict]:
    """Extract fields from a single incident block."""

    def extract(field: str) -> str:
        pattern = rf"^{field}:\s*(.+?)(?=\n[A-Z_]+:|$)"
        match = re.search(pattern, block, re.IGNORECASE | re.MULTILINE | re.DOTALL)
        if match:
            return match.group(1).strip().strip('"')
        return ""

    description = extract("DESCRIPTION")
    if not description:
        return None

    # Date parsing
    date_raw = extract("DATE")
    date_precision = extract("DATE_PRECISION") or "unknown"
    date = parse_date(date_raw, date_precision)

    # People — split comma list
    people_raw = extract("PEOPLE")
    people = parse_list_field(people_raw)

    # Locations — split comma list
    locations_raw = extract("LOCATIONS")
    locations = parse_list_field(locations_raw)

    # Category — use prompt's category if model returns wrong/empty
    cat_raw = extract("CATEGORY")
    final_category = cat_raw if cat_raw else category

    # Access tier
    tier_raw = extract("ACCESS_TIER")
    try:
        access_tier = int(tier_raw[0]) if tier_raw else access_tier_default
        if access_tier not in (1, 2, 3):
            access_tier = access_tier_default
    except Exception:
        access_tier = access_tier_default

    # Source chunk
    source_chunk = extract("SOURCE_CHUNK")

    return {
        "description": description,
        "date": date,
        "date_precision": date_precision,
        "people": people,
        "locations": locations,
        "category": final_category,
        "access_tier": access_tier,
        "source_chunk": source_chunk,
        "confidence": "auto_extracted",
        "verified": False,
    }


def parse_date(date_raw: str, precision: str) -> dict:
    """Convert raw date string to structured date object."""
    if not date_raw or date_raw.lower() in ("unknown", "none", ""):
        return {"year": None, "period": date_raw or "unknown", "precision": "unknown"}

    date_raw_lower = date_raw.lower().strip()

    # Try exact year
    year_match = re.search(r"\b(18|19|20)\d{2}\b", date_raw)
    year = int(year_match.group()) if year_match else None

    # Try to extract month
    months = {
        "january": 1, "february": 2, "march": 3, "april": 4,
        "may": 5, "june": 6, "july": 7, "august": 8,
        "september": 9, "october": 10, "november": 11, "december": 12,
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    }
    month = None
    for m_name, m_num in months.items():
        if m_name in date_raw_lower:
            month = m_num
            break

    # Decade detection
    decade_match = re.search(r"(early|mid|late)?\s*(18|19|20)\d{1}0s?", date_raw_lower)
    if decade_match and not year:
        decade_str = re.search(r"(18|19|20)\d{1}0", date_raw_lower)
        if decade_str:
            year = int(decade_str.group())
            precision = "decade"

    return {
        "year": year,
        "month": month,
        "period": date_raw,
        "precision": precision or ("exact" if year and month else "approximate" if year else "unknown"),
    }


def parse_list_field(raw: str) -> list[str]:
    """Parse comma-separated list, cleaning up empties and 'none'."""
    if not raw or raw.lower().strip() in ("none", "n/a", ""):
        return []
    items = [i.strip() for i in re.split(r"[,;]", raw)]
    return [i for i in items if i and i.lower() not in ("none", "n/a", "-")]


def clean_response_text(text: str) -> str:
    """Remove common NotebookLM preamble patterns."""
    # Remove "Based on the sources provided..." style intros
    preamble_patterns = [
        r"^Based on (the|this) (sources?|transcript|notebook|text).*?\n\n",
        r"^Here (are|is) the incidents?.*?:\n\n",
        r"^I (found|identified|extracted).*?\n\n",
        r"^The (following|transcript|sources?).*?\n\n",
    ]
    for pattern in preamble_patterns:
        text = re.sub(pattern, "", text, flags=re.IGNORECASE | re.DOTALL)
    return text.strip()
