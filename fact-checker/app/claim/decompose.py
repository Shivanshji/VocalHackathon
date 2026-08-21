"""
Claim decomposer — breaks compound claims into atomic sub-claims.

A compound claim like "India's GDP grew 7% and unemployment fell to 3%"
becomes two atomic claims that can each be independently verified.
"""

import json
import logging

from google import genai

from app.config import settings
from app.utils.llm import generate_content_safe

logger = logging.getLogger(__name__)

DECOMPOSE_PROMPT = """You are a fact-checking assistant. Your task is to decompose a claim into atomic, independently-checkable sub-claims.

An atomic claim contains exactly ONE verifiable fact. Examples:
- Compound: "India's GDP grew 7% and unemployment fell to 3%"
  → ["India's GDP grew 7%.", "India's unemployment fell to 3%."]
- Already atomic: "India's unemployment rate is 2%."
  → ["India's unemployment rate is 2%."]

Rules:
1. Each sub-claim must be a complete, self-contained sentence.
2. Each sub-claim must be independently verifiable via web search.
3. Preserve specific numbers, dates, names, and entities exactly.
4. If the claim is already atomic, return it as the only item.
5. Do NOT add information not present in the original.

Respond with ONLY a JSON object:
{{
  "sub_claims": ["claim 1", "claim 2", ...],
  "is_compound": true/false
}}

Claim: {claim}"""


async def decompose_claim(canonical_claim: str) -> dict:
    """
    Decompose a canonical claim into atomic sub-claims.

    Args:
        canonical_claim: Normalized claim from the normalize step.

    Returns:
        dict with keys:
            - sub_claims (list[str]): List of atomic sub-claims.
            - is_compound (bool): Whether the original claim was compound.
    """
    client = genai.Client(api_key=settings.gemini_api_key)

    prompt = DECOMPOSE_PROMPT.format(claim=canonical_claim)

    try:
        response = await generate_content_safe(
            client=client,
            model=settings.llm_model,
            contents=prompt,
        )

        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            text = text.rsplit("```", 1)[0]

        result = json.loads(text)

        sub_claims = result.get("sub_claims", [canonical_claim])
        is_compound = result.get("is_compound", len(sub_claims) > 1)

        logger.info(
            "Decomposed claim into %d sub-claim(s): %s",
            len(sub_claims),
            sub_claims,
        )
        return {
            "sub_claims": sub_claims,
            "is_compound": is_compound,
        }

    except json.JSONDecodeError as e:
        logger.error("Failed to parse decomposition response: %s", e)
        return {
            "sub_claims": [canonical_claim],
            "is_compound": False,
        }
    except Exception as e:
        logger.error("Claim decomposition failed: %s", e)
        raise
