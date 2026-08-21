"""
LLM utilities — provides a rate-limit safe completion wrapper with
exponential backoff retry for Gemini API 429 Resource Exhausted errors.
"""

import asyncio
import logging
from google.genai.errors import ClientError

logger = logging.getLogger(__name__)


async def generate_content_safe(
    client,
    model: str,
    contents: str,
    max_retries: int = 5,
    base_delay: float = 8.0,
):
    """
    Call Gemini models.generate_content with exponential backoff on 429 rate limits.

    Runs the synchronous SDK call in an executor thread to avoid blocking the event loop.
    """
    for attempt in range(max_retries):
        try:
            # client.models.generate_content is synchronous, run in thread
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=model,
                contents=contents,
            )
            return response

        except ClientError as e:
            # Check if rate limited
            is_rate_limited = e.code == 429 or "RESOURCE_EXHAUSTED" in str(e) or "429" in str(e)
            
            if is_rate_limited and attempt < max_retries - 1:
                # Exponential backoff
                delay = base_delay * (1.5 ** attempt)
                logger.warning(
                    "Rate limit hit (429) for model %s. Retrying attempt %d/%d in %.1fs...",
                    model,
                    attempt + 1,
                    max_retries,
                    delay,
                )
                await asyncio.sleep(delay)
            else:
                logger.error("Gemini API ClientError: %s", e)
                raise e

        except Exception as e:
            logger.error("Unexpected error calling Gemini API: %s", e)
            raise e
