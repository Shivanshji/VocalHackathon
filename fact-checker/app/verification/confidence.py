"""
Confidence calculator — produces a CALCULATED (not LLM-guessed) confidence
score from pipeline signals.

This is a core differentiator per the plan's declared constraint #2:
"Handle being wrong — explicit INSUFFICIENT_EVIDENCE verdict and a
calculated confidence score combining source quality, evidence relevance,
source agreement, and claim clarity."

Components:
1. Source quality:    weighted average authority of evidence sources
2. Evidence relevance: average semantic similarity (from relevance.py)
3. Source agreement:  % of sources agreeing on the dominant stance
4. Evidence volume:   penalty if too few sources found

Formula:
  confidence = (w1 * source_quality + w2 * relevance + w3 * agreement) * volume_factor

All weights and thresholds are explicit and tunable — no black-box LLM score.
"""

import logging
from typing import List

logger = logging.getLogger(__name__)

# --- Configurable weights ---
W_SOURCE_QUALITY = 0.30
W_RELEVANCE = 0.30
W_AGREEMENT = 0.40

# Volume scaling: confidence is penalized if fewer than this many sources
MIN_EVIDENCE_COUNT = 3
VOLUME_FLOOR = 0.5  # minimum volume factor (even with 1 source)


def _source_quality_score(evidence_items: List[dict]) -> float:
    """Weighted average of source authority scores."""
    if not evidence_items:
        return 0.0
    scores = [item.get("source_quality", 0.5) for item in evidence_items]
    return sum(scores) / len(scores)


def _relevance_score(evidence_items: List[dict]) -> float:
    """Average semantic relevance of evidence to the claim."""
    if not evidence_items:
        return 0.0
    scores = [item.get("relevance_score", 0.0) for item in evidence_items]
    return sum(scores) / len(scores)


def _agreement_score(evidence_items: List[dict]) -> float:
    """
    Proportion of sources that agree on the dominant stance.

    High agreement (all support or all contradict) → high score.
    Mixed stances → low score, reflecting genuine uncertainty.
    """
    if not evidence_items:
        return 0.0

    stance_counts = {"supports": 0, "contradicts": 0, "neutral": 0}
    for item in evidence_items:
        stance = item.get("stance", "neutral").lower()
        if stance in stance_counts:
            stance_counts[stance] += 1
        else:
            stance_counts["neutral"] += 1

    # Only count non-neutral stances for agreement
    opinionated = stance_counts["supports"] + stance_counts["contradicts"]
    if opinionated == 0:
        return 0.3  # All neutral = low agreement, not zero

    dominant_count = max(stance_counts["supports"], stance_counts["contradicts"])
    return dominant_count / opinionated


def _volume_factor(evidence_count: int) -> float:
    """
    Penalty factor if too few evidence items were found.

    Returns 1.0 if count >= MIN_EVIDENCE_COUNT, scales linearly down
    to VOLUME_FLOOR for count = 1.
    """
    if evidence_count >= MIN_EVIDENCE_COUNT:
        return 1.0
    if evidence_count <= 0:
        return 0.0
    # Linear interpolation from VOLUME_FLOOR to 1.0
    return VOLUME_FLOOR + (1.0 - VOLUME_FLOOR) * (evidence_count / MIN_EVIDENCE_COUNT)


def calculate_confidence(evidence_items: List[dict]) -> dict:
    """
    Calculate a composite confidence score from pipeline signals.

    Args:
        evidence_items: List of evidence dicts with 'source_quality',
                        'relevance_score', and 'stance' fields.

    Returns:
        dict with:
            - confidence (float): Final score 0.0 to 1.0
            - breakdown (dict): Individual component scores for transparency
    """
    sq = _source_quality_score(evidence_items)
    rel = _relevance_score(evidence_items)
    agr = _agreement_score(evidence_items)
    vol = _volume_factor(len(evidence_items))

    raw_score = (W_SOURCE_QUALITY * sq + W_RELEVANCE * rel + W_AGREEMENT * agr)
    confidence = round(raw_score * vol, 4)

    # Clamp to [0, 1]
    confidence = max(0.0, min(1.0, confidence))

    breakdown = {
        "source_quality": round(sq, 4),
        "relevance": round(rel, 4),
        "agreement": round(agr, 4),
        "volume_factor": round(vol, 4),
        "raw_score": round(raw_score, 4),
        "evidence_count": len(evidence_items),
    }

    logger.info(
        "Confidence: %.3f (quality=%.2f, relevance=%.2f, agreement=%.2f, volume=%.2f) "
        "from %d evidence items",
        confidence, sq, rel, agr, vol, len(evidence_items),
    )

    return {
        "confidence": confidence,
        "breakdown": breakdown,
    }
