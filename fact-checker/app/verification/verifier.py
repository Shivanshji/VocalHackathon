"""
Verifier — synthesizes all evidence into a final verdict.

Takes the ranked, scored evidence items and uses the LLM to produce
a structured verdict: SUPPORTED, CONTRADICTED, MISLEADING, or 
INSUFFICIENT_EVIDENCE, with a human-readable explanation.

The LLM sees the evidence but does NOT set the confidence score —
that's calculated separately by confidence.py from pipeline signals.
"""

import json
import logging

from typing import List

from google import genai

from app.config import settings
from app.utils.llm import generate_content_safe

logger = logging.getLogger(__name__)

VERIFY_PROMPT = """You are a rigorous fact-checking assistant. Synthesize the evidence below to reach a verdict on the claim.

CLAIM: {claim}

EVIDENCE (ranked by source quality):
{evidence_text}

Based on this evidence, determine your verdict:
- SUPPORTED: Multiple reliable sources confirm the claim is accurate.
- CONTRADICTED: Reliable sources present data/facts that directly refute the claim.
- MISLEADING: The claim is partially true but omits critical context, uses outdated data, or exaggerates.
- INSUFFICIENT_EVIDENCE: Not enough reliable evidence to confirm or refute the claim.

Rules:
1. Weight higher-quality sources more heavily.
2. If sources disagree, note the disagreement and lean toward the more authoritative sources.
3. Be specific in your explanation — cite the actual data found vs. what was claimed.
4. If the claim uses a specific number and the real number differs, explain the discrepancy.
5. Do NOT guess a confidence score — that is calculated separately.

Respond with ONLY a JSON object:
{{
  "verdict": "SUPPORTED|CONTRADICTED|MISLEADING|INSUFFICIENT_EVIDENCE",
  "explanation": "Clear, specific explanation citing actual evidence found",
  "key_finding": "One-sentence summary of the most important finding"
}}"""


async def verify_claim(claim: str, evidence_items: List[dict]) -> dict:
    """
    Produce a verdict by synthesizing all evidence for a claim.

    Args:
        claim: The atomic claim being verified.
        evidence_items: List of evidence dicts with stance, text, source_quality,
                        and relevance_score.

    Returns:
        dict with keys:
            - verdict (str): One of SUPPORTED, CONTRADICTED, MISLEADING, INSUFFICIENT_EVIDENCE
            - explanation (str): Human-readable explanation
            - key_finding (str): One-sentence summary
    """
    if not evidence_items:
        logger.warning("No evidence available for claim: %s", claim[:80])
        return {
            "verdict": "INSUFFICIENT_EVIDENCE",
            "explanation": "No relevant evidence was found from web searches to verify or refute this claim.",
            "key_finding": "No evidence found.",
        }

    # Format evidence for the prompt, sorted by source quality
    sorted_evidence = sorted(
        evidence_items,
        key=lambda e: e.get("source_quality", 0),
        reverse=True,
    )

    evidence_text = ""
    for i, item in enumerate(sorted_evidence):
        evidence_text += (
            f"\n[{i+1}] Source: {item.get('title', 'Unknown')} "
            f"(quality: {item.get('source_quality', 0):.2f}, "
            f"relevance: {item.get('relevance_score', 0):.2f})\n"
            f"    Stance: {item.get('stance', 'unknown')}\n"
            f"    Evidence: {item.get('text', '')}\n"
        )

    client = genai.Client(api_key=settings.gemini_api_key)

    prompt = VERIFY_PROMPT.format(claim=claim, evidence_text=evidence_text)

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

        verdict = result.get("verdict", "INSUFFICIENT_EVIDENCE")
        # Validate verdict is one of the allowed values
        valid_verdicts = {"SUPPORTED", "CONTRADICTED", "MISLEADING", "INSUFFICIENT_EVIDENCE"}
        if verdict not in valid_verdicts:
            logger.warning("Invalid verdict '%s', defaulting to INSUFFICIENT_EVIDENCE", verdict)
            verdict = "INSUFFICIENT_EVIDENCE"

        logger.info("Verdict for '%s...': %s", claim[:60], verdict)

        return {
            "verdict": verdict,
            "explanation": result.get("explanation", ""),
            "key_finding": result.get("key_finding", ""),
        }

    except json.JSONDecodeError as e:
        logger.error("Failed to parse verification response: %s", e)
        return {
            "verdict": "INSUFFICIENT_EVIDENCE",
            "explanation": "The verification system encountered an error processing the evidence.",
            "key_finding": "Verification error.",
        }
    except Exception as e:
        logger.error("Verification failed: %s", e)
        raise
