"""
Tavily API client — performs web searches and returns full metadata.

Returns 8-10 results per query with full page content, not just LLM summaries.
This is critical because we need the raw text for evidence extraction.
"""

import asyncio
import logging
from typing import List

from tavily import TavilyClient

from app.config import settings

logger = logging.getLogger(__name__)


def _get_client() -> TavilyClient:
    """Create a Tavily client instance."""
    return TavilyClient(api_key=settings.tavily_api_key)


async def search(query: str, max_results: int = 8) -> List[dict]:
    """
    Search the web using Tavily and return structured results.

    Args:
        query: Search query string.
        max_results: Maximum number of results to return (default 8).

    Returns:
        List of dicts, each with keys:
            - title (str): Page title
            - url (str): Page URL
            - content (str): Relevant text content from the page
            - score (float): Tavily relevance score
            - raw_content (str | None): Full raw page content if available
    """
    client = _get_client()

    try:
        response = await asyncio.to_thread(
            client.search,
            query=query,
            search_depth="advanced",
            max_results=max_results,
            include_raw_content=True,
        )

        results = []
        for item in response.get("results", []):
            results.append({
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "content": item.get("content", ""),
                "score": item.get("score", 0.0),
                "raw_content": item.get("raw_content"),
            })

        logger.info(
            "Tavily search for '%s' returned %d results",
            query[:60],
            len(results),
        )
        return results

    except Exception as e:
        logger.error("Tavily search failed for query '%s': %s", query[:60], e)
        return []


async def search_multiple(queries: List[str], max_results_per_query: int = 5) -> List[dict]:
    """
    Search with multiple queries in parallel, deduplicate results by URL.

    Args:
        queries: List of search queries.
        max_results_per_query: Max results per individual query.

    Returns:
        Deduplicated list of search results.
    """
    all_results = []
    seen_urls = set()

    # Run all search queries concurrently
    tasks = [search(query, max_results=max_results_per_query) for query in queries]
    queries_results = await asyncio.gather(*tasks)

    for results in queries_results:
        for result in results:
            url = result["url"]
            if url not in seen_urls:
                seen_urls.add(url)
                all_results.append(result)

    logger.info(
        "Multi-query search: %d queries → %d unique results",
        len(queries),
        len(all_results),
    )
    return all_results
