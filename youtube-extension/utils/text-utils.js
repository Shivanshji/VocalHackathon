/**
 * text-utils.js — Text normalization and hashing utilities.
 *
 * Used by claim-detector and cache-service for consistent
 * text normalization before comparison or hashing.
 */

/**
 * Normalize a claim for comparison/hashing.
 * Lowercase, strip punctuation, collapse whitespace.
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * FNV-1a 32-bit hash — fast, deterministic, no dependencies.
 * @param {string} str
 * @returns {string} hex hash
 */
function hashString(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
    hash >>>= 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Hash a claim for cache key generation.
 * @param {string} claim
 * @returns {string}
 */
function hashClaim(claim) {
  return hashString(normalizeText(claim));
}

/**
 * Detect sentence boundaries and split text into sentences.
 * Handles common abbreviations and avoids false splits.
 * @param {string} text
 * @returns {string[]}
 */
function splitIntoSentences(text) {
  if (!text || text.trim().length === 0) return [];

  // Handle common abbreviations to avoid false splits
  const cleaned = text
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|e\.g|i\.e|U\.S|U\.K)\./gi, '$1ABBR')
    .replace(/\b(\d+)\./g, '$1NUMABBR');

  const sentences = cleaned.split(/(?<=[.!?])\s+(?=[A-Z])/);

  return sentences
    .map(s => s.replace(/ABBR/g, '.').replace(/NUMABBR/g, '.').trim())
    .filter(s => s.length > 0);
}

/**
 * Count words in a string.
 * @param {string} text
 * @returns {number}
 */
function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Truncate text to a max length, adding ellipsis.
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
function truncate(text, maxLength = 100) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Check if two strings are substantially similar (Jaccard similarity).
 * Used for deduplication of near-duplicate claims.
 * @param {string} a
 * @param {string} b
 * @param {number} threshold 0.0 – 1.0
 * @returns {boolean}
 */
function isSimilar(a, b, threshold = 0.7) {
  const setA = new Set(normalizeText(a).split(' '));
  const setB = new Set(normalizeText(b).split(' '));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return false;
  return intersection.size / union.size >= threshold;
}

/**
 * Format seconds as MM:SS timestamp string.
 * @param {number} seconds
 * @returns {string}
 */
function formatTimestamp(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
