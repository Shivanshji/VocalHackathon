/**
 * cache-service.js — In-memory claim result cache (content-script side).
 *
 * The service worker has persistent chrome.storage.local cache.
 * This is the fast in-memory cache for the current page session,
 * so we don't even need to message the SW for already-seen claims.
 *
 * Cleared when the video changes (via TranscriptManager.reset()).
 */

class CacheService {
  constructor({ maxSize = 200, ttlMs = 60 * 60 * 1000 } = {}) {
    this._cache = new Map();  // hash → { result, timestamp, claim }
    this._maxSize = maxSize;
    this._ttlMs = ttlMs;
    this._hits = 0;
    this._misses = 0;
  }

  /**
   * Store a fact-check result.
   * @param {string} hash - claim hash (from hashClaim())
   * @param {string} claim - original claim text
   * @param {Object} result - FactCheckResult
   */
  set(hash, claim, result) {
    // Evict oldest entry if at capacity
    if (this._cache.size >= this._maxSize) {
      const oldestKey = this._cache.keys().next().value;
      this._cache.delete(oldestKey);
    }
    this._cache.set(hash, { result, claim, timestamp: Date.now() });
  }

  /**
   * Retrieve a cached result.
   * @param {string} hash
   * @returns {Object|null}
   */
  get(hash) {
    const entry = this._cache.get(hash);
    if (!entry) {
      this._misses++;
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this._ttlMs) {
      this._cache.delete(hash);
      this._misses++;
      return null;
    }

    this._hits++;
    return entry.result;
  }

  /**
   * Check if a hash is cached.
   * @param {string} hash
   * @returns {boolean}
   */
  has(hash) {
    return this.get(hash) !== null;
  }

  /**
   * Clear all cached results (called on video change).
   */
  clear() {
    const count = this._cache.size;
    this._cache.clear();
    this._hits = 0;
    this._misses = 0;
    console.log(`[SachMei Cache] Cleared ${count} entries.`);
  }

  /**
   * Get all cached entries as an array.
   * @returns {Array<{hash, claim, result, timestamp}>}
   */
  getAll() {
    return Array.from(this._cache.entries()).map(([hash, entry]) => ({
      hash,
      ...entry,
    }));
  }

  /**
   * Stats for debugging.
   */
  getStats() {
    return {
      size: this._cache.size,
      hits: this._hits,
      misses: this._misses,
      hitRate: this._hits + this._misses > 0
        ? (this._hits / (this._hits + this._misses)).toFixed(2)
        : 'N/A',
    };
  }
}

// Singleton for this content script context
const sachMeiCache = new CacheService();
