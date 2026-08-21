"""
Source ranker — scores sources by domain authority and quality.

Uses a curated tier list of domains:
- Tier 1 (0.95-1.0): Government (.gov), international orgs (WHO, UN), 
  top-tier wire services (Reuters, AP)
- Tier 2 (0.80-0.94): Major newspapers, established fact-checkers
- Tier 3 (0.60-0.79): Regional news, well-known magazines
- Tier 4 (0.40-0.59): General web sources
- Tier 5 (0.10-0.39): Blogs, forums, unknown domains

This is a policy decision, not an LLM call — deterministic and auditable.
"""

import logging
from typing import List
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# --- Domain authority tiers ---
# Higher score = more authoritative

TIER_1_DOMAINS = {
    # Government
    "gov.in", "nic.in", "rbi.org.in", "pib.gov.in",
    "gov.uk", "gov.au", "europa.eu", "state.gov",
    # International organizations
    "who.int", "un.org", "worldbank.org", "imf.org",
    "ilo.org", "unicef.org", "data.worldbank.org",
    # Top-tier wire services
    "reuters.com", "apnews.com", "afp.com",
}

TIER_2_DOMAINS = {
    # Major newspapers
    "nytimes.com", "washingtonpost.com", "theguardian.com",
    "bbc.com", "bbc.co.uk", "economist.com", "ft.com",
    # Indian major outlets
    "thehindu.com", "indianexpress.com", "livemint.com",
    "ndtv.com", "hindustantimes.com", "timesofindia.indiatimes.com",
    # Fact-checkers
    "factcheck.org", "politifact.com", "snopes.com",
    "altnews.in", "boomlive.in", "thequint.com",
    # Data / research
    "statista.com", "pewresearch.org", "nature.com",
    "sciencedirect.com", "pubmed.ncbi.nlm.nih.gov",
    "census.gov", "data.gov.in",
}

TIER_3_DOMAINS = {
    # Regional / well-known
    "cnbc.com", "bloomberg.com", "forbes.com",
    "wired.com", "arstechnica.com", "theatlantic.com",
    "scroll.in", "thewire.in", "firstpost.com",
    "moneycontrol.com", "business-standard.com",
    "deccanherald.com", "telegraphindia.com",
    "news18.com",
    # Wikipedia (good for cross-reference, not primary)
    "wikipedia.org", "en.wikipedia.org",
}

# Tier scores
TIER_SCORES = {
    1: 0.97,
    2: 0.85,
    3: 0.70,
    4: 0.50,
    5: 0.25,
}


def _extract_domain(url: str) -> str:
    """Extract the registrable domain from a URL."""
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname or ""
        # Remove 'www.' prefix
        if hostname.startswith("www."):
            hostname = hostname[4:]
        return hostname.lower()
    except Exception:
        return ""


def _get_tier(domain: str) -> int:
    """Determine which tier a domain belongs to."""
    # Check exact match and parent domains
    parts = domain.split(".")
    for i in range(len(parts)):
        candidate = ".".join(parts[i:])
        if candidate in TIER_1_DOMAINS:
            return 1
        if candidate in TIER_2_DOMAINS:
            return 2
        if candidate in TIER_3_DOMAINS:
            return 3

    # Check for government TLDs
    if domain.endswith(".gov") or domain.endswith(".gov.in"):
        return 1
    if domain.endswith(".edu") or domain.endswith(".ac.in"):
        return 2

    return 4  # Default: general web source


def score_source(url: str) -> float:
    """
    Score a single source by its domain authority.

    Args:
        url: The URL of the source.

    Returns:
        Quality score between 0.0 and 1.0.
    """
    domain = _extract_domain(url)
    if not domain:
        return TIER_SCORES[5]

    tier = _get_tier(domain)
    score = TIER_SCORES[tier]

    logger.debug("Source %s → tier %d → score %.2f", domain, tier, score)
    return score


def rank_sources(search_results: List[dict]) -> List[dict]:
    """
    Rank search results by source quality.

    Mutates each result dict to add a 'source_quality' field,
    then returns the list sorted by source_quality descending.

    Args:
        search_results: List of search result dicts (must have 'url' key).

    Returns:
        Same list, sorted by source_quality (highest first), with
        'source_quality' and 'domain' fields added.
    """
    for result in search_results:
        url = result.get("url", "")
        result["source_quality"] = score_source(url)
        result["domain"] = _extract_domain(url)

    ranked = sorted(search_results, key=lambda r: r["source_quality"], reverse=True)

    logger.info(
        "Ranked %d sources. Top: %s (%.2f), Bottom: %s (%.2f)",
        len(ranked),
        ranked[0].get("domain", "?") if ranked else "N/A",
        ranked[0].get("source_quality", 0) if ranked else 0,
        ranked[-1].get("domain", "?") if ranked else "N/A",
        ranked[-1].get("source_quality", 0) if ranked else 0,
    )
    return ranked
