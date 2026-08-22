/**
 * claim-detector.js — Smart Claim Filtering Pipeline for YouTube Captions.
 *
 * Designed specifically for YouTube subtitles (including auto-generated ASR
 * captions which are often lowercase and lack punctuation).
 *
 * Pipeline:
 *   Text Chunking (8-16 words / 4-6s) → Signal Scoring → Deduplication → Fact-Check
 */

class ClaimDetector {
  constructor() {
    this._recentClaims = new Set();
    this._maxRecentClaims = 100;

    // Buffer state
    this._buffer = '';
    this._bufferStartTime = 0;
    this._bufferSegments = [];
    this._minWords = 6;      // minimum words to form a checkable statement
    this._maxWords = 24;     // maximum words before forcing a chunk
    this._maxSeconds = 6;    // flush every ~6 seconds for natural speech flow
  }

  // ─────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────

  /**
   * Process an incoming transcript segment.
   *
   * @param {{ text: string, start: number, duration: number }} segment
   * @returns {{ shouldCheck: boolean, claim: string, startTime: number, endTime: number, signals: string[] }|null}
   */
  processSegment(segment) {
    if (!segment || !segment.text) return null;

    const text = segment.text.trim();
    if (!text) return null;

    if (this._bufferSegments.length === 0) {
      this._bufferStartTime = segment.start || 0;
    }

    this._buffer += (this._buffer ? ' ' : '') + text;
    this._bufferSegments.push(segment);

    const words = this._buffer.split(/\s+/).filter(Boolean).length;
    const duration = (segment.start || 0) - this._bufferStartTime;

    // Flush triggers:
    // 1. Punctuation ending (period, question mark, exclamation)
    // 2. Word count target reached (10-20 words is ideal for a factual sentence)
    // 3. Time duration target reached (5-7 seconds)
    const hasPunctuation = /[.!?]\s*$/.test(this._buffer);
    const hasTargetWords = words >= 10;
    const isOverMaxWords = words >= this._maxWords;
    const isOverMaxTime = duration >= this._maxSeconds && words >= this._minWords;

    if (hasPunctuation || hasTargetWords || isOverMaxWords || isOverMaxTime) {
      const endTime = (segment.start || 0) + (segment.duration || 3);
      return this._flushBuffer(endTime);
    }

    return null;
  }

  /**
   * Force flush any remaining buffer.
   */
  flush() {
    if (!this._buffer.trim()) return null;
    return this._flushBuffer(this._bufferStartTime + 5);
  }

  /**
   * Evaluate if a text string contains a checkable factual claim.
   *
   * @param {string} rawText
   * @returns {{ isFactualClaim: boolean, reason: string, canonicalClaim: string, signals: string[] }}
   */
  detectClaim(rawText) {
    if (!rawText) return { isFactualClaim: false, reason: 'Empty text' };

    let text = rawText.trim();
    const words = text.split(/\s+/).filter(Boolean);

    if (words.length < this._minWords) {
      return { isFactualClaim: false, reason: 'Too short' };
    }

    // Strip leading conversational fillers rather than rejecting
    text = this._cleanFillers(text);

    // Filter pure greetings/outro fluff
    if (this._isPureSocialFluff(text)) {
      return { isFactualClaim: false, reason: 'Social/channel fluff' };
    }

    // Detect factual signals (numbers, news terms, entities, actions)
    const { score, signals } = this._detectSignals(text);

    // Deduplication check
    const hash = this._hash(text);
    if (this._recentClaims.has(hash)) {
      return { isFactualClaim: false, reason: 'Duplicate claim' };
    }

    // Pass any statement with at least 1 strong factual signal (score >= 0.1)
    if (score < 0.1) {
      return { isFactualClaim: false, reason: `Low factual score (${score.toFixed(2)})`, signals };
    }

    this._addToRecent(hash);

    const canonicalClaim = this._canonicalize(text);

    return {
      isFactualClaim: true,
      reason: `Signals: ${signals.join(', ')}`,
      canonicalClaim,
      signals,
    };
  }

  reset() {
    this._buffer = '';
    this._bufferStartTime = 0;
    this._bufferSegments = [];
    this._recentClaims.clear();
  }

  // ─────────────────────────────────────────────
  // Internal Helpers
  // ─────────────────────────────────────────────

  _flushBuffer(endTime) {
    const text = this._buffer.trim();
    const startTime = this._bufferStartTime;

    this._buffer = '';
    this._bufferSegments = [];
    this._bufferStartTime = 0;

    if (!text) return null;

    const res = this.detectClaim(text);
    if (!res.isFactualClaim) return null;

    return {
      shouldCheck: true,
      claim: res.canonicalClaim || text,
      startTime,
      endTime,
      signals: res.signals || [],
    };
  }

  _cleanFillers(text) {
    return text
      .replace(/^(um+|uh+|ah+|like|you know|basically|literally|so|well|okay|alright)\s+/gi, '')
      .replace(/^(and|but|or|so)\s+/gi, '')
      .trim();
  }

  _isPureSocialFluff(text) {
    return /^(please\s+)?(like\s+and\s+subscribe|subscribe\s+to|comment\s+below|hit\s+the\s+bell|welcome\s+back|see\s+you\s+in\s+the\s+next)\b/i.test(text);
  }

  _detectSignals(text) {
    const signals = [];
    let score = 0;
    const lower = text.toLowerCase();

    // 1. Numbers, Statistics, Currencies, Quantities (works with ₹, $, %, words)
    if (/[\$₹€£]?\d+([.,]\d+)?\s*(cr|crore|lakh|k|m|b|billion|million|thousand|%|percent|kg|km|meter|feet|days?|months?|years?|hours?|am|pm)?\b/i.test(text) ||
        /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|billion|crore|lakh|first|second|third|fourth|fifth)\b/i.test(lower)) {
      signals.push('quantity/stat');
      score += 0.35;
    }

    // 2. Factual & Action Verbs (launched, arrested, bribed, signed, passed, won, died, etc.)
    if (/\b(launch(ed)?|arrest(ed)?|summon(ed)?|kill(ed)?|charg(ed)?|warn(ed|s)?|defeat(ed)?|approv(ed)?|reject(ed)?|pass(ed)?|sign(ed)?|increas(ed|ing)?|decreas(ed|ing)?|claim(ed|s)?|announc(ed|s)?|stat(ed|es)?|report(ed|s)?|confirm(ed)?|deni(ed|es)?|investigat(ed|ing|ion)?|probe|sought|bust|alleg(ed|edly|ations?)?|accused|found|built|won|lost|died|brib(e|ed|ery)?|scam|raid(ed)?)\b/i.test(lower)) {
      signals.push('action-verb');
      score += 0.35;
    }

    // 3. Organizations, Government, Institutions, Countries, Law Enforcement
    if (/\b(ncb|cbi|ed|police|court|supreme court|high court|judge|ministry|minister|prime minister|president|government|parliament|congress|bjp|aap|army|military|navy|air force|isro|nasa|un|who|nato|rbi|fbi|cia|india|pakistan|china|us|usa|uk|russia|delhi|mumbai|kashmir|bengaluru|chennai)\b/i.test(lower)) {
      signals.push('organization/place');
      score += 0.4;
    }

    // 4. News & Legal / Public Figures terms
    if (/\b(case|officer|general|chief|leader|custody|bail|jail|prison|verdict|witness|inquiry|drug|corruption|fraud|election|poll|vote|tax|bill|law|order|treaty|accord|strike|clash|attack|war|crisis)\b/i.test(lower)) {
      signals.push('news-topic');
      score += 0.3;
    }

    // 5. Proper names / Entities (2+ consecutive capitalized words, or known name patterns)
    if (/[A-Z][a-z]+\s+[A-Z][a-z]+/.test(text)) {
      signals.push('named-entity');
      score += 0.25;
    }

    return { score: Math.min(1.0, score), signals };
  }

  _canonicalize(text) {
    let clean = text.replace(/\s+/g, ' ').trim();
    // Capitalize first letter
    if (clean.length > 0) {
      clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    }
    // Add period if no ending punctuation
    if (!/[.!?]$/.test(clean)) {
      clean += '.';
    }
    return clean;
  }

  _hash(text) {
    const normalized = text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    let hash = 2166136261;
    for (let i = 0; i < normalized.length; i++) {
      hash ^= normalized.charCodeAt(i);
      hash = (hash * 16777619) >>> 0;
    }
    return hash.toString(16);
  }

  _addToRecent(hash) {
    this._recentClaims.add(hash);
    if (this._recentClaims.size > this._maxRecentClaims) {
      const first = this._recentClaims.values().next().value;
      this._recentClaims.delete(first);
    }
  }
}

// Singleton
const claimDetector = new ClaimDetector();
