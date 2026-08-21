"""
Evidence extractor — uses LLM to extract relevant snippets from search
results and label each snippet's stance relative to the claim.

For each search result, this module:
1. Extracts the most relevant text passage related to the claim
2. Labels the stance: 'supports', 'contradicts', or 'neutral'
3. Provides a brief reasoning for the stance label
"""

import json
import logging
from typing import List

from google import genai

from app.config import settings
from app.utils.llm import generate_content_safe

logger = logging.getLogger(__name__)

EXTRACT_PROMPT = """You are a fact-checking assistant. Analyze these search results relative to the claim and extract evidence.

CLAIM: {claim}

SEARCH RESULTS:
{results_text}

For each result that contains relevant information about the claim, extract:
1. The most relevant text passage (verbatim or close paraphrase)
2. The stance: does this evidence "supports", "contradicts", or is "neutral" to the claim?
3. Brief reasoning for your stance label

Respond with ONLY a JSON object:
{{
  "evidence": [
    {{
      "result_index": 0,
      "relevant_text": "extracted text passage",
      "stance": "supports|contradicts|neutral",
      "reasoning": "brief explanation"
    }}
  ]
}}

Rules:
- Only include results that have genuine relevance to the claim.
- Skip results that are off-topic or too vague to determine stance.
- Extract specific facts, numbers, dates — not vague statements.
- Be precise about stance: "supports" means the evidence confirms the claim, 
  "contradicts" means it refutes the claim, "neutral" means it's related but 
  doesn't clearly confirm or refute."""


async def extract_evidence(claim: str, search_results: List[dict]) -> List[dict]:
    """
    Extract relevant evidence from search results for a given claim.

    Args:
        claim: The atomic claim being verified.
        search_results: List of search result dicts (with 'title', 'url', 'content' keys).

    Returns:
        List of evidence dicts, each with:
            - title (str): Source page title
            - url (str): Source URL
            - text (str): Relevant extracted text
            - stance (str): 'supports', 'contradicts', or 'neutral'
            - reasoning (str): Why this stance was assigned
            - source_quality (float): Carried from source_ranker if available
    """
    if not search_results:
        logger.warning("No search results to extract evidence from")
        return []

    # Format results for the prompt
    results_text = ""
    for i, result in enumerate(search_results):
        content = result.get("content", "") or ""
        # Truncate very long content to avoid hitting token limits
        if len(content) > 1500:
            content = content[:1500] + "..."
        results_text += f"\n[{i}] Title: {result.get('title', 'Unknown')}\n"
        results_text += f"    URL: {result.get('url', '')}\n"
        results_text += f"    Content: {content}\n"

    client = genai.Client(api_key=settings.gemini_api_key)

    prompt = EXTRACT_PROMPT.format(claim=claim, results_text=results_text)

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

        parsed = json.loads(text)
        raw_evidence = parsed.get("evidence", [])

        # Merge extracted evidence with source metadata
        evidence_items = []
        for item in raw_evidence:
            idx = item.get("result_index", -1)
            if 0 <= idx < len(search_results):
                source = search_results[idx]
                evidence_items.append({
                    "title": source.get("title", "Unknown"),
                    "url": source.get("url", ""),
                    "text": item.get("relevant_text", ""),
                    "stance": item.get("stance", "neutral"),
                    "reasoning": item.get("reasoning", ""),
                    "source_quality": source.get("source_quality", 0.5),
                })

        logger.info(
            "Extracted %d evidence items from %d search results for claim: %s...",
            len(evidence_items),
            len(search_results),
            claim[:60],
        )
        return evidence_items

    except json.JSONDecodeError as e:
        logger.error("Failed to parse evidence extraction response: %s", e)
        return []
    except Exception as e:
        logger.error("Evidence extraction failed: %s", e)
        raise
