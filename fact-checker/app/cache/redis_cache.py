"""
Redis cache — caches fact-check results by canonical claim.

Gracefully degrades: if Redis is unavailable, the application
continues without caching (every request hits the full pipeline).
"""

import json
import logging
from typing import Optional

import redis

from app.config import settings

logger = logging.getLogger(__name__)

# Module-level client — lazy initialized
_client: Optional[redis.Redis] = None
_available: Optional[bool] = None

# Cache TTL: 1 hour (claims can become stale with new data)
CACHE_TTL_SECONDS = 3600


def _get_client() -> Optional[redis.Redis]:
    """Get or create the Redis client. Returns None if Redis is unavailable."""
    global _client, _available

    if _available is False:
        return None

    if _client is None:
        try:
            _client = redis.from_url(
                settings.redis_url,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            _client.ping()
            _available = True
            logger.info("Redis connected at %s", settings.redis_url)
        except Exception as e:
            logger.warning("Redis unavailable (%s). Running without cache.", e)
            _available = False
            _client = None
            return None

    return _client


def _make_key(canonical_claim: str) -> str:
    """Create a cache key from a canonical claim."""
    return f"factcheck:{canonical_claim.strip().lower()}"


def get_cached_result(canonical_claim: str) -> Optional[dict]:
    """
    Look up a cached fact-check result.

    Args:
        canonical_claim: The normalized claim text.

    Returns:
        Cached result dict, or None if not found / Redis unavailable.
    """
    client = _get_client()
    if client is None:
        return None

    key = _make_key(canonical_claim)
    try:
        data = client.get(key)
        if data:
            logger.info("Cache HIT for: %s...", canonical_claim[:60])
            return json.loads(data)
        logger.debug("Cache MISS for: %s...", canonical_claim[:60])
        return None
    except Exception as e:
        logger.warning("Cache read error: %s", e)
        return None


def cache_result(canonical_claim: str, result: dict) -> bool:
    """
    Store a fact-check result in the cache.

    Args:
        canonical_claim: The normalized claim text (used as key).
        result: The full result dict to cache.

    Returns:
        True if cached successfully, False otherwise.
    """
    client = _get_client()
    if client is None:
        return False

    key = _make_key(canonical_claim)
    try:
        client.set(key, json.dumps(result, default=str), ex=CACHE_TTL_SECONDS)
        logger.info("Cached result for: %s...", canonical_claim[:60])
        return True
    except Exception as e:
        logger.warning("Cache write error: %s", e)
        return False


def invalidate(canonical_claim: str) -> bool:
    """Invalidate a cached result."""
    client = _get_client()
    if client is None:
        return False

    key = _make_key(canonical_claim)
    try:
        client.delete(key)
        return True
    except Exception as e:
        logger.warning("Cache invalidation error: %s", e)
        return False
