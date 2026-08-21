"""
Claim normalizer — canonicalizes a raw English claim.

Strips filler words, standardizes phrasing, fixes grammar, and produces
a clean, self-contained declarative statement suitable for web search
and fact-checking.
"""

import json
import logging

from google import genai

from app.config import settings
from app.utils.llm import generate_content_safe

logger = logging.getLogger(__name__)

NORMALIZE_PROMPT = """You are a fact-checking assistant. Your task is to normalize a claim.

Given a raw English sentence that was translated from spoken Indic-language speech, 
produce a clean, canonical version of the claim.

Rules:
1. Remove filler words, hedging, and speech artifacts.
2. Standardize numbers, dates, percentages to a consistent format.
3. Ensure the claim is a single, self-contained declarative sentence.
4. Preserve the original meaning exactly — do NOT add or remove information.
5. If the text contains multiple distinct claims, keep only the primary/strongest one.

Respond with ONLY a JSON object:
{{
  "canonical_claim": "the normalized claim text",
  "is_verifiable": true/false,
  "reason": "brief reason if not verifiable"
}}

Raw text: {text}"""


async def normalize_claim(english_text: str) -> dict:
    """
    Normalize a raw English claim into canonical form.

    Args:
        english_text: Raw translated English text from P2.

    Returns:
        dict with keys:
            - canonical_claim (str): Normalized claim text.
            - is_verifiable (bool): Whether the claim can be fact-checked.
            - reason (str | None): Why the claim is not verifiable (if applicable).
    """
    client = genai.Client(api_key=settings.gemini_api_key)

    prompt = NORMALIZE_PROMPT.format(text=english_text)

    try:
        response = await generate_content_safe(
            client=client,
            model=settings.llm_model,
            contents=prompt,
        )

        # Parse JSON from the response
        text = response.text.strip()
        # Handle markdown code blocks if the model wraps in ```json
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            text = text.rsplit("```", 1)[0]
        
        result = json.loads(text)

        logger.info(
            "Normalized claim: %s -> %s",
            english_text[:80],
            result.get("canonical_claim", "")[:80],
        )
        return {
            "canonical_claim": result["canonical_claim"],
            "is_verifiable": result.get("is_verifiable", True),
            "reason": result.get("reason"),
        }

    except json.JSONDecodeError as e:
        logger.error("Failed to parse LLM response as JSON: %s", e)
        # Fallback: use the raw text as the canonical claim
        return {
            "canonical_claim": english_text.strip(),
            "is_verifiable": True,
            "reason": None,
        }
    except Exception as e:
        logger.error("Claim normalization failed: %s", e)
        raise
