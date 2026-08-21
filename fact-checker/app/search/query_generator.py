"""
Query generator — produces search queries for both supporting AND
contradicting a claim.

Dual-sided retrieval is critical: searching only for supporting evidence
introduces confirmation bias. We explicitly generate queries that would
find evidence on both sides.
"""

import json
import logging

from google import genai

from app.config import settings
from app.utils.llm import generate_content_safe

logger = logging.getLogger(__name__)

QUERY_GEN_PROMPT = """You are a fact-checking assistant. Generate web search queries to verify a claim.

You MUST generate queries on BOTH sides:
- Queries that would find SUPPORTING evidence (if the claim is true)
- Queries that would find CONTRADICTING evidence (if the claim is false)

This dual-sided approach prevents confirmation bias.

Rules:
1. Generate 2-3 supporting queries and 2-3 contradicting queries.
2. Queries should be concise and search-engine-friendly (no full sentences).
3. Include specific entities, numbers, dates from the claim.
4. For contradicting queries, look for the actual/real data rather than just adding "false" to the query.

Respond with ONLY a JSON object:
{{
  "supporting_queries": ["query1", "query2", ...],
  "contradicting_queries": ["query1", "query2", ...],
  "key_entities": ["entity1", "entity2", ...]
}}

Claim: {claim}"""


async def generate_queries(claim: str) -> dict:
    """
    Generate dual-sided search queries for a claim.

    Args:
        claim: A single atomic claim to generate queries for.

    Returns:
        dict with keys:
            - supporting_queries (list[str]): Queries to find supporting evidence.
            - contradicting_queries (list[str]): Queries to find contradicting evidence.
            - key_entities (list[str]): Key entities extracted from the claim.
            - all_queries (list[str]): Combined list of all queries.
    """
    client = genai.Client(api_key=settings.gemini_api_key)

    prompt = QUERY_GEN_PROMPT.format(claim=claim)

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

        supporting = result.get("supporting_queries", [])
        contradicting = result.get("contradicting_queries", [])
        entities = result.get("key_entities", [])

        all_queries = supporting + contradicting

        logger.info(
            "Generated %d queries for claim: %s... (%d supporting, %d contradicting)",
            len(all_queries),
            claim[:60],
            len(supporting),
            len(contradicting),
        )

        return {
            "supporting_queries": supporting,
            "contradicting_queries": contradicting,
            "key_entities": entities,
            "all_queries": all_queries,
        }

    except json.JSONDecodeError as e:
        logger.error("Failed to parse query generation response: %s", e)
        # Fallback: use the claim itself as a query
        return {
            "supporting_queries": [claim],
            "contradicting_queries": [f"{claim} fact check"],
            "key_entities": [],
            "all_queries": [claim, f"{claim} fact check"],
        }
    except Exception as e:
        logger.error("Query generation failed: %s", e)
        raise
