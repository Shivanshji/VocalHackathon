"""
End-to-end pipeline integration test.

Tests the full POST /fact-check endpoint with all LLM calls mocked.
Verifies that the pipeline correctly:
1. Accepts P2's input JSON
2. Returns P1's output JSON with all required fields
3. Preserves session_id, segment_id, start, end
"""

import json
import pytest
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient


# --- Mock all LLM + external calls ---


def _mock_genai_client():
    """Create a mock Gemini client that returns different responses based on prompt content."""
    mock_client = MagicMock()

    def mock_generate(model, contents):
        response = MagicMock()

        if "normalize" in contents.lower() or "canonical" in contents.lower():
            response.text = json.dumps({
                "canonical_claim": "India's unemployment rate is 2%.",
                "is_verifiable": True,
                "reason": None,
            })
        elif "decompose" in contents.lower() or "atomic" in contents.lower():
            response.text = json.dumps({
                "sub_claims": ["India's unemployment rate is 2%."],
                "is_compound": False,
            })
        elif "search queries" in contents.lower() or "web search" in contents.lower():
            response.text = json.dumps({
                "supporting_queries": ["India unemployment rate 2%"],
                "contradicting_queries": ["India real unemployment rate"],
                "key_entities": ["India", "unemployment"],
            })
        elif "evidence" in contents.lower() and "extract" in contents.lower():
            response.text = json.dumps({
                "evidence": [
                    {
                        "result_index": 0,
                        "relevant_text": "India's unemployment rate was 7.8% in 2023.",
                        "stance": "contradicts",
                        "reasoning": "Official data shows a much higher rate.",
                    }
                ]
            })
        elif "verdict" in contents.lower() or "verify" in contents.lower():
            response.text = json.dumps({
                "verdict": "CONTRADICTED",
                "explanation": "Official government data shows India's unemployment rate is 7.8%, not 2%.",
                "key_finding": "The claimed 2% rate is significantly lower than official figures.",
            })
        else:
            response.text = json.dumps({"error": "unknown prompt type"})

        return response

    mock_client.models.generate_content.side_effect = mock_generate
    return mock_client


SAMPLE_INPUT = {
    "session_id": "test_session_001",
    "segment_id": "seg_28",
    "start": 84.3,
    "end": 89.1,
    "english_text": "India's unemployment rate has fallen to two percent.",
    "should_fact_check": True,
    "statement_type": "factual_claim",
    "routing_reason": "Contains a measurable claim about India's unemployment rate.",
}


@pytest.fixture
def client():
    """Create a test client with mocked external dependencies."""
    # Mock settings to avoid requiring real API keys
    with patch("app.config.settings") as mock_settings:
        mock_settings.gemini_api_key = "test-key"
        mock_settings.tavily_api_key = "test-key"
        mock_settings.llm_model = "gemini-2.0-flash"
        mock_settings.redis_url = "redis://localhost:6379/0"
        mock_settings.database_url = "postgresql+asyncpg://localhost/test"
        mock_settings.log_level = "WARNING"

        from app.main import app
        yield TestClient(app)


@pytest.mark.asyncio
async def test_full_pipeline_integration(client):
    """Full pipeline should accept P2 input and return P1 output with all fields."""
    mock_client = _mock_genai_client()

    mock_tavily = MagicMock()
    mock_tavily.search.return_value = {
        "results": [
            {
                "title": "India Employment Statistics - Government of India",
                "url": "https://data.gov.in/employment",
                "content": "India's unemployment rate was 7.8% in 2023 according to CMIE data.",
                "score": 0.95,
                "raw_content": None,
            }
        ]
    }

    with patch("app.claim.normalize.genai.Client", return_value=mock_client), \
         patch("app.claim.decompose.genai.Client", return_value=mock_client), \
         patch("app.search.query_generator.genai.Client", return_value=mock_client), \
         patch("app.evidence.extractor.genai.Client", return_value=mock_client), \
         patch("app.verification.verifier.genai.Client", return_value=mock_client), \
         patch("app.search.tavily_client.TavilyClient", return_value=mock_tavily), \
         patch("app.cache.redis_cache.get_cached_result", return_value=None), \
         patch("app.cache.redis_cache.cache_result", return_value=True), \
         patch("app.database.repositories.save_claim_result", return_value=1), \
         patch("app.evidence.relevance._get_model", return_value="UNAVAILABLE"):

        response = client.post("/fact-check", json=SAMPLE_INPUT)

    assert response.status_code == 200
    data = response.json()

    # Verify all required fields exist
    assert data["session_id"] == "test_session_001"
    assert data["segment_id"] == "seg_28"
    assert data["start"] == 84.3
    assert data["end"] == 89.1
    assert data["original_text"] == SAMPLE_INPUT["english_text"]
    assert "canonical_claim" in data
    assert data["verdict"] in ["SUPPORTED", "CONTRADICTED", "MISLEADING", "INSUFFICIENT_EVIDENCE"]
    assert 0.0 <= data["confidence"] <= 1.0
    assert "explanation" in data
    assert isinstance(data["evidence"], list)
    assert "checked_at" in data
    assert data["status"] in ["verified", "cached", "error"]


def test_health_endpoint(client):
    """Health check should return ok."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_skip_non_factual(client):
    """Claims with should_fact_check=false should be skipped."""
    skip_input = {**SAMPLE_INPUT, "should_fact_check": False}
    response = client.post("/fact-check", json=skip_input)
    assert response.status_code == 200
    data = response.json()
    assert data["verdict"] == "INSUFFICIENT_EVIDENCE"
    assert data["confidence"] == 0.0
