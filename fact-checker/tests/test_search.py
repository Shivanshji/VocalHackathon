"""
Tests for search-related modules: query generation, Tavily client, source ranking.
"""

import json
import pytest
from unittest.mock import patch, MagicMock


# ── Source ranker tests (no mocks needed — pure logic) ──

def test_score_source_tier1():
    """Government and wire services should get tier-1 scores."""
    from app.search.source_ranker import score_source
    assert score_source("https://pib.gov.in/some-release") == 0.97
    assert score_source("https://www.reuters.com/article/123") == 0.97


def test_score_source_tier2():
    """Major newspapers and fact-checkers should get tier-2 scores."""
    from app.search.source_ranker import score_source
    assert score_source("https://www.thehindu.com/news/article") == 0.85
    assert score_source("https://www.snopes.com/fact-check/something") == 0.85


def test_score_source_tier3():
    """Regional and well-known outlets should get tier-3 scores."""
    from app.search.source_ranker import score_source
    assert score_source("https://www.forbes.com/article") == 0.70
    assert score_source("https://en.wikipedia.org/wiki/Something") == 0.70


def test_score_source_unknown():
    """Unknown domains should get tier-4 (general web) scores."""
    from app.search.source_ranker import score_source
    assert score_source("https://randomsite123.com/page") == 0.50


def test_rank_sources_ordering():
    """rank_sources should sort results by source_quality descending."""
    from app.search.source_ranker import rank_sources

    results = [
        {"url": "https://randomsite.com/page", "title": "Random"},
        {"url": "https://reuters.com/article", "title": "Reuters"},
        {"url": "https://thehindu.com/news", "title": "The Hindu"},
    ]

    ranked = rank_sources(results)
    assert ranked[0]["source_quality"] == 0.97  # Reuters
    assert ranked[1]["source_quality"] == 0.85  # The Hindu
    assert ranked[2]["source_quality"] == 0.50  # Random


# ── Query generator tests ──

@pytest.mark.asyncio
async def test_generate_queries():
    """generate_queries should produce both supporting and contradicting queries."""
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "supporting_queries": ["India unemployment rate 2%", "India jobs data"],
        "contradicting_queries": ["India real unemployment rate", "India unemployment statistics"],
        "key_entities": ["India", "unemployment rate", "2%"],
    })

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    with patch("app.search.query_generator.genai.Client", return_value=mock_client):
        from app.search.query_generator import generate_queries
        result = await generate_queries("India's unemployment rate is 2%.")

    assert len(result["supporting_queries"]) == 2
    assert len(result["contradicting_queries"]) == 2
    assert len(result["all_queries"]) == 4
    assert "India" in result["key_entities"]


@pytest.mark.asyncio
async def test_generate_queries_fallback():
    """If LLM returns invalid JSON, should fallback to using the claim itself."""
    mock_response = MagicMock()
    mock_response.text = "not valid json"

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    with patch("app.search.query_generator.genai.Client", return_value=mock_client):
        from app.search.query_generator import generate_queries
        result = await generate_queries("Some claim")

    assert len(result["all_queries"]) == 2  # claim + "claim fact check"
