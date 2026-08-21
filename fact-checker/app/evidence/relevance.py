"""
Evidence relevance scorer — uses Sentence-Transformers to compute
semantic similarity between a claim and each evidence snippet.

This is NOT an LLM call — it's a local embedding model that runs fast
and provides a grounded similarity score for the confidence calculation.

Uses `all-MiniLM-L6-v2` (22M params, ~80ms per batch on CPU).
"""

import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

# Lazy-load the model to avoid slow startup if not needed
_model = None


def _get_model():
    """Lazy-load the sentence transformer model."""
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            logger.info("Loading sentence-transformers model (all-MiniLM-L6-v2)...")
            _model = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("Model loaded successfully")
        except ImportError:
            logger.warning(
                "sentence-transformers not installed. "
                "Relevance scores will use a fallback heuristic."
            )
            _model = "UNAVAILABLE"
        except Exception as e:
            logger.error("Failed to load sentence-transformers model: %s", e)
            _model = "UNAVAILABLE"
    return _model


def _keyword_overlap_score(claim: str, text: str) -> float:
    """
    Fallback heuristic: Jaccard similarity on lowercased word sets.
    Used when sentence-transformers is not available.
    """
    claim_words = set(claim.lower().split())
    text_words = set(text.lower().split())
    # Remove common stop words
    stop_words = {"the", "a", "an", "is", "are", "was", "were", "of", "to", "in",
                  "for", "on", "with", "at", "by", "from", "that", "this", "it",
                  "and", "or", "but", "not", "has", "have", "had", "be", "been"}
    claim_words -= stop_words
    text_words -= stop_words
    if not claim_words or not text_words:
        return 0.0
    intersection = claim_words & text_words
    union = claim_words | text_words
    return len(intersection) / len(union)


def compute_relevance_scores(
    claim: str,
    evidence_items: List[dict],
    text_key: str = "text",
) -> List[dict]:
    """
    Compute semantic similarity between a claim and each evidence item.

    Mutates each evidence dict to add a 'relevance_score' field (0.0 to 1.0).

    Args:
        claim: The claim text to compare against.
        evidence_items: List of evidence dicts (must have `text_key` field).
        text_key: Key in each evidence dict containing the text to compare.

    Returns:
        Same list with 'relevance_score' added to each item.
    """
    if not evidence_items:
        return evidence_items

    model = _get_model()

    if model == "UNAVAILABLE":
        # Fallback: keyword overlap
        for item in evidence_items:
            item["relevance_score"] = _keyword_overlap_score(
                claim, item.get(text_key, "")
            )
        logger.info("Used keyword-overlap fallback for %d items", len(evidence_items))
        return evidence_items

    try:
        # Encode claim + all evidence texts in one batch
        texts = [item.get(text_key, "") for item in evidence_items]
        all_texts = [claim] + texts

        embeddings = model.encode(all_texts, normalize_embeddings=True)

        claim_embedding = embeddings[0]
        evidence_embeddings = embeddings[1:]

        # Cosine similarity (embeddings are already normalized)
        for i, item in enumerate(evidence_items):
            similarity = float(claim_embedding @ evidence_embeddings[i])
            # Clamp to [0, 1] — cosine sim can be negative for very dissimilar texts
            item["relevance_score"] = max(0.0, min(1.0, similarity))

        logger.info(
            "Computed relevance scores for %d evidence items. "
            "Range: %.3f – %.3f",
            len(evidence_items),
            min(item["relevance_score"] for item in evidence_items),
            max(item["relevance_score"] for item in evidence_items),
        )

    except Exception as e:
        logger.error("Embedding-based relevance scoring failed: %s. Using fallback.", e)
        for item in evidence_items:
            item["relevance_score"] = _keyword_overlap_score(
                claim, item.get(text_key, "")
            )

    return evidence_items
