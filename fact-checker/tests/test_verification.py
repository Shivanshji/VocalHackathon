"""
Tests for verification and confidence calculation modules.
"""

import json
import pytest
from unittest.mock import patch, MagicMock


# ── Confidence calculator tests (pure logic, no mocks) ──

def test_confidence_high_agreement():
    """High-quality, relevant, agreeing sources should produce high confidence."""
    from app.verification.confidence import calculate_confidence

    evidence = [
        {"source_quality": 0.97, "relevance_score": 0.90, "stance": "supports"},
        {"source_quality": 0.85, "relevance_score": 0.85, "stance": "supports"},
        {"source_quality": 0.85, "relevance_score": 0.80, "stance": "supports"},
    ]

    result = calculate_confidence(evidence)
    assert result["confidence"] > 0.80
    assert result["breakdown"]["agreement"] == 1.0  # 100% agreement


def test_confidence_mixed_stances():
    """Mixed stances should produce lower agreement and thus lower confidence."""
    from app.verification.confidence import calculate_confidence

    evidence = [
        {"source_quality": 0.90, "relevance_score": 0.85, "stance": "supports"},
        {"source_quality": 0.85, "relevance_score": 0.80, "stance": "contradicts"},
        {"source_quality": 0.70, "relevance_score": 0.75, "stance": "supports"},
    ]

    result = calculate_confidence(evidence)
    # Agreement should be 2/3 = 0.667
    assert 0.60 < result["breakdown"]["agreement"] < 0.70


def test_confidence_low_volume_penalty():
    """Fewer than MIN_EVIDENCE_COUNT sources should apply volume penalty."""
    from app.verification.confidence import calculate_confidence

    evidence = [
        {"source_quality": 0.97, "relevance_score": 0.95, "stance": "supports"},
    ]

    result = calculate_confidence(evidence)
    assert result["breakdown"]["volume_factor"] < 1.0


def test_confidence_no_evidence():
    """No evidence should produce zero confidence."""
    from app.verification.confidence import calculate_confidence

    result = calculate_confidence([])
    assert result["confidence"] == 0.0


def test_confidence_all_neutral():
    """All neutral stances should produce low agreement score."""
    from app.verification.confidence import calculate_confidence

    evidence = [
        {"source_quality": 0.85, "relevance_score": 0.80, "stance": "neutral"},
        {"source_quality": 0.70, "relevance_score": 0.75, "stance": "neutral"},
        {"source_quality": 0.70, "relevance_score": 0.70, "stance": "neutral"},
    ]

    result = calculate_confidence(evidence)
    assert result["breakdown"]["agreement"] == 0.3  # all-neutral fallback


# ── Verifier tests ──

@pytest.mark.asyncio
async def test_verify_claim_supported():
    """Verifier should return SUPPORTED verdict for confirming evidence."""
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "verdict": "SUPPORTED",
        "explanation": "Multiple authoritative sources confirm the claim.",
        "key_finding": "Government data confirms the stated rate.",
    })

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    with patch("app.verification.verifier.genai.Client", return_value=mock_client):
        from app.verification.verifier import verify_claim
        result = await verify_claim(
            "India's unemployment rate is 3.2%.",
            [
                {"title": "Gov Report", "source_quality": 0.97,
                 "relevance_score": 0.9, "stance": "supports", "text": "Rate is 3.2%"},
            ],
        )

    assert result["verdict"] == "SUPPORTED"


@pytest.mark.asyncio
async def test_verify_claim_no_evidence():
    """Verifier should return INSUFFICIENT_EVIDENCE when no evidence is provided."""
    from app.verification.verifier import verify_claim
    result = await verify_claim("Some claim", [])

    assert result["verdict"] == "INSUFFICIENT_EVIDENCE"


@pytest.mark.asyncio
async def test_verify_claim_invalid_verdict_fallback():
    """Invalid verdicts from LLM should default to INSUFFICIENT_EVIDENCE."""
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "verdict": "MAYBE_TRUE",  # Invalid
        "explanation": "Not sure.",
        "key_finding": "Unclear.",
    })

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    with patch("app.verification.verifier.genai.Client", return_value=mock_client):
        from app.verification.verifier import verify_claim
        result = await verify_claim(
            "Some claim",
            [{"title": "Source", "source_quality": 0.5,
              "relevance_score": 0.5, "stance": "neutral", "text": "info"}],
        )

    assert result["verdict"] == "INSUFFICIENT_EVIDENCE"
