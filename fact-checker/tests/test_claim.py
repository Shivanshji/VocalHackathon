"""
Tests for claim normalization and decomposition modules.
"""

import json
import pytest
from unittest.mock import patch, MagicMock, AsyncMock


# ── Normalize tests ──

@pytest.mark.asyncio
async def test_normalize_claim_basic():
    """normalize_claim should return a canonical claim, is_verifiable, and reason."""
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "canonical_claim": "India's unemployment rate is 2%.",
        "is_verifiable": True,
        "reason": None,
    })

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    with patch("app.claim.normalize.genai.Client", return_value=mock_client):
        from app.claim.normalize import normalize_claim
        result = await normalize_claim(
            "So basically India's unemployment rate has you know fallen to about two percent"
        )

    assert result["canonical_claim"] == "India's unemployment rate is 2%."
    assert result["is_verifiable"] is True
    assert result["reason"] is None


@pytest.mark.asyncio
async def test_normalize_claim_unverifiable():
    """Non-verifiable claims should be flagged."""
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "canonical_claim": "The weather is nice today.",
        "is_verifiable": False,
        "reason": "Subjective statement, not a factual claim.",
    })

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    with patch("app.claim.normalize.genai.Client", return_value=mock_client):
        from app.claim.normalize import normalize_claim
        result = await normalize_claim("The weather is really nice today")

    assert result["is_verifiable"] is False
    assert result["reason"] is not None


@pytest.mark.asyncio
async def test_normalize_claim_json_fallback():
    """If LLM returns invalid JSON, should fall back to raw text."""
    mock_response = MagicMock()
    mock_response.text = "This is not valid JSON at all"

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    with patch("app.claim.normalize.genai.Client", return_value=mock_client):
        from app.claim.normalize import normalize_claim
        result = await normalize_claim("India GDP is 7 percent")

    # Should fallback to the raw text
    assert result["canonical_claim"] == "India GDP is 7 percent"
    assert result["is_verifiable"] is True


# ── Decompose tests ──

@pytest.mark.asyncio
async def test_decompose_compound_claim():
    """Compound claims should be split into atomic sub-claims."""
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "sub_claims": [
            "India's GDP grew 7%.",
            "India's unemployment fell to 3%.",
        ],
        "is_compound": True,
    })

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    with patch("app.claim.decompose.genai.Client", return_value=mock_client):
        from app.claim.decompose import decompose_claim
        result = await decompose_claim(
            "India's GDP grew 7% and unemployment fell to 3%."
        )

    assert len(result["sub_claims"]) == 2
    assert result["is_compound"] is True


@pytest.mark.asyncio
async def test_decompose_atomic_claim():
    """Atomic claims should return as-is."""
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "sub_claims": ["India's unemployment rate is 2%."],
        "is_compound": False,
    })

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    with patch("app.claim.decompose.genai.Client", return_value=mock_client):
        from app.claim.decompose import decompose_claim
        result = await decompose_claim("India's unemployment rate is 2%.")

    assert len(result["sub_claims"]) == 1
    assert result["is_compound"] is False
