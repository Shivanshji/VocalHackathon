/**
 * SachMei Chrome Extension — Service Worker (Background)
 *
 * Responsibilities:
 *  - API communication (fact-check calls)
 *  - Request management (queueing, dedup, rate limiting)
 *  - Caching (claim hash → result)
 *  - Settings management
 *  - Cross-tab messaging hub
 *
 * Does NOT interact with YouTube DOM — that's the content script's job.
 */

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────

const CONFIG = {
  // Replace with your actual API key / endpoint when connecting a real provider.
  // For development, we use the MockProvider (no key needed).
  PROVIDER: 'mock',          // 'mock' | 'gemini' | 'openai' | 'google-factcheck'
  GEMINI_API_KEY: '',        // Set in options page — stored in chrome.storage.sync
  OPENAI_API_KEY: '',
  GOOGLE_FC_API_KEY: '',

  // Rate limiting
  MAX_CONCURRENT_REQUESTS: 2,
  REQUEST_COOLDOWN_MS: 3000,   // Min time between fact-check calls
  CACHE_TTL_MS: 24 * 60 * 60 * 1000,  // 24 hours

  // Claim processing
  MIN_CLAIM_LENGTH: 20,
  MAX_CLAIM_LENGTH: 500,
};

// ─────────────────────────────────────────────
// In-memory state (resets when SW is killed/restarted)
// ─────────────────────────────────────────────

let pendingRequests = new Map();   // claimHash → Promise
let requestQueue = [];
let activeRequestCount = 0;
let lastRequestTime = 0;

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

/**
 * Simple FNV-1a hash for claim deduplication.
 * Fast, deterministic, no crypto needed.
 */
function hashClaim(text) {
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(16);
}

/**
 * Get or set item in chrome.storage.local with TTL.
 */
async function getCachedResult(hash) {
  try {
    const key = `fc_${hash}`;
    const result = await chrome.storage.local.get(key);
    if (result[key]) {
      const { data, timestamp } = result[key];
      if (Date.now() - timestamp < CONFIG.CACHE_TTL_MS) {
        return data;
      }
      // Expired — remove
      await chrome.storage.local.remove(key);
    }
  } catch (e) {
    console.warn('[SachMei SW] Cache read error:', e);
  }
  return null;
}

async function setCachedResult(hash, data) {
  try {
    const key = `fc_${hash}`;
    await chrome.storage.local.set({
      [key]: { data, timestamp: Date.now() }
    });
  } catch (e) {
    console.warn('[SachMei SW] Cache write error:', e);
  }
}

// ─────────────────────────────────────────────
// Fact-Check Providers
// ─────────────────────────────────────────────

/**
 * Base class for all fact-check providers.
 * Swap providers without touching the rest of the extension.
 */
class FactCheckProvider {
  /**
   * @param {Object} claimData
   * @param {string} claimData.claim
   * @param {string} claimData.context
   * @param {string} claimData.videoId
   * @param {number} claimData.timestamp
   * @returns {Promise<FactCheckResult>}
   */
  async checkClaim(claimData) {
    throw new Error('FactCheckProvider.checkClaim() must be implemented');
  }
}

/**
 * FactCheckResult schema (mirrors fact-checker backend output).
 */
class FactCheckResult {
  constructor({ verdict, confidence, explanation, sources, canonicalClaim, keyFinding }) {
    this.verdict = verdict;           // 'TRUE' | 'FALSE' | 'MISLEADING' | 'PARTIALLY_TRUE' | 'UNVERIFIABLE'
    this.confidence = confidence;     // 0.0 – 1.0
    this.explanation = explanation;   // Human-readable explanation
    this.sources = sources || [];     // [{ title, url }]
    this.canonicalClaim = canonicalClaim || '';
    this.keyFinding = keyFinding || '';
  }
}

// ── Mock Provider ──────────────────────────────────────────────────────────

const MOCK_RESPONSES = [
  {
    verdict: 'TRUE',
    confidence: 0.91,
    explanation: 'Multiple reliable sources confirm this claim is accurate based on historical records and verified data.',
    keyFinding: 'The claim is supported by authoritative sources.',
    sources: [
      { title: 'Wikipedia', url: 'https://en.wikipedia.org' },
      { title: 'Reuters Fact Check', url: 'https://reuters.com/fact-check' },
    ]
  },
  {
    verdict: 'FALSE',
    confidence: 0.87,
    explanation: 'Fact-checkers have debunked this claim. Official data directly contradicts what was stated.',
    keyFinding: 'The claim contradicts official verified data.',
    sources: [
      { title: 'AP Fact Check', url: 'https://apnews.com/hub/ap-fact-check' },
      { title: 'FactCheck.org', url: 'https://factcheck.org' },
    ]
  },
  {
    verdict: 'MISLEADING',
    confidence: 0.78,
    explanation: 'The statement contains some truth, but omits critical context that would substantially change its meaning.',
    keyFinding: 'Partially accurate but lacks important context.',
    sources: [
      { title: 'Snopes', url: 'https://snopes.com' },
      { title: 'PolitiFact', url: 'https://politifact.com' },
    ]
  },
  {
    verdict: 'PARTIALLY_TRUE',
    confidence: 0.72,
    explanation: 'Some aspects of this claim are accurate while others are incorrect or exaggerated.',
    keyFinding: 'Mixed evidence — partially accurate.',
    sources: [
      { title: 'BBC Reality Check', url: 'https://bbc.com/news/reality_check' },
      { title: 'Full Fact', url: 'https://fullfact.org' },
    ]
  },
  {
    verdict: 'UNVERIFIABLE',
    confidence: 0.35,
    explanation: 'Insufficient evidence was found to confirm or deny this claim with reasonable certainty.',
    keyFinding: 'Not enough reliable evidence to determine accuracy.',
    sources: []
  },
];

class MockProvider extends FactCheckProvider {
  constructor() {
    super();
    this._callCount = 0;
  }

  async checkClaim(claimData) {
    // Simulate network latency (800ms – 2500ms)
    const delay = 800 + Math.random() * 1700;
    await new Promise(r => setTimeout(r, delay));

    // Cycle through mock responses for variety
    const response = MOCK_RESPONSES[this._callCount % MOCK_RESPONSES.length];
    this._callCount++;

    return new FactCheckResult({
      ...response,
      canonicalClaim: claimData.claim,
    });
  }
}

// ── Gemini Provider ────────────────────────────────────────────────────────

class GeminiProvider extends FactCheckProvider {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
    this.models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash'];
  }

  async checkClaim(claimData) {
    const { claim, context } = claimData;

    const prompt = `You are a real-time fact-checker for video content. Evaluate the following factual claim and return a structured JSON verdict.

CLAIM: "${claim}"
CONTEXT FROM VIDEO: "${context || 'None'}"

Evaluate the claim for factual accuracy. Return ONLY a valid JSON object with this exact structure:
{
  "verdict": "TRUE" | "FALSE" | "MISLEADING" | "PARTIALLY_TRUE" | "UNVERIFIABLE",
  "confidence": 0.85,
  "explanation": "Clear 1-2 sentence explanation of why this claim is true/false/misleading.",
  "keyFinding": "One concise takeaway sentence.",
  "sources": [{"title": "Source name", "url": "https://example.com"}]
}

Verdict definitions:
- TRUE: Factually accurate according to reliable public reporting/data.
- FALSE: Demonstrably incorrect or debunked.
- MISLEADING: Contains element of truth but distorts context or draws false conclusion.
- PARTIALLY_TRUE: Mixture of true and false elements.
- UNVERIFIABLE: Insufficient public evidence exists to confirm or deny.`;

    let lastError = null;

    for (const model of this.models) {
      try {
        console.log(`[SachMei SW] Calling Gemini API (${model})...`);
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.1,
                responseMimeType: 'application/json'
              }
            })
          }
        );

        if (!response.ok) {
          const errBody = await response.text();
          console.warn(`[SachMei SW] Gemini ${model} returned ${response.status}:`, errBody);
          lastError = new Error(`Gemini ${response.status}: ${errBody}`);
          if (response.status === 404) continue; // Try fallback model
          throw lastError;
        }

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) throw new Error('Empty response from Gemini');

        // Clean any accidental markdown backticks
        const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        const validVerdicts = ['TRUE', 'FALSE', 'MISLEADING', 'PARTIALLY_TRUE', 'UNVERIFIABLE'];
        if (!validVerdicts.includes(parsed.verdict)) {
          parsed.verdict = 'UNVERIFIABLE';
        }

        return new FactCheckResult({
          verdict: parsed.verdict,
          confidence: Math.max(0, Math.min(1, parsed.confidence || 0.75)),
          explanation: parsed.explanation || 'No explanation provided.',
          keyFinding: parsed.keyFinding || '',
          sources: Array.isArray(parsed.sources) ? parsed.sources : [],
          canonicalClaim: claim,
        });

      } catch (err) {
        lastError = err;
        if (err.message.includes('404')) continue;
        throw err;
      }
    }

    throw lastError || new Error('All Gemini models failed');
  }
}

// ── Provider Factory ───────────────────────────────────────────────────────

async function createProvider() {
  const settings = await chrome.storage.sync.get(['provider', 'geminiApiKey', 'openaiApiKey']);
  const provider = settings.provider || CONFIG.PROVIDER;

  switch (provider) {
    case 'gemini':
      if (!settings.geminiApiKey) {
        console.warn('[SachMei SW] Gemini provider selected but no API key. Falling back to Mock.');
        return new MockProvider();
      }
      return new GeminiProvider(settings.geminiApiKey);

    case 'mock':
    default:
      return new MockProvider();
  }
}

// ─────────────────────────────────────────────
// Core fact-check pipeline
// ─────────────────────────────────────────────

let _provider = null;

async function getProvider() {
  if (!_provider) {
    _provider = await createProvider();
  }
  return _provider;
}

// Reset provider when settings change
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && (changes.provider || changes.geminiApiKey)) {
    _provider = null;
    console.log('[SachMei SW] Provider reset due to settings change.');
  }
});

/**
 * Main entry point: fact-check a claim.
 * Handles caching, dedup, rate limiting, queueing.
 */
async function factCheckClaim(claimData) {
  const hash = hashClaim(claimData.claim);

  // 1. Check persistent cache
  const cached = await getCachedResult(hash);
  if (cached) {
    console.log(`[SachMei SW] Cache hit for: "${claimData.claim.substring(0, 60)}..."`);
    return { ...cached, fromCache: true };
  }

  // 2. Dedup in-flight requests
  if (pendingRequests.has(hash)) {
    console.log('[SachMei SW] Request already in-flight, awaiting...');
    return pendingRequests.get(hash);
  }

  // 3. Rate limiting
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < CONFIG.REQUEST_COOLDOWN_MS) {
    await new Promise(r => setTimeout(r, CONFIG.REQUEST_COOLDOWN_MS - timeSinceLast));
  }

  // 4. Execute
  const promise = (async () => {
    try {
      lastRequestTime = Date.now();
      const provider = await getProvider();
      const result = await provider.checkClaim(claimData);
      const resultPlain = { ...result, hash, checkedAt: new Date().toISOString() };

      // Persist to cache
      await setCachedResult(hash, resultPlain);

      return resultPlain;
    } finally {
      pendingRequests.delete(hash);
    }
  })();

  pendingRequests.set(hash, promise);
  return promise;
}

// ─────────────────────────────────────────────
// Message handler
// ─────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;

  switch (type) {
    // Content script requesting a fact-check
    case 'FACT_CHECK_CLAIM': {
      factCheckClaim(payload)
        .then(result => sendResponse({ success: true, result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // async response
    }

    // Popup or content checking if extension is enabled
    case 'GET_SETTINGS': {
      chrome.storage.sync.get(
        ['enabled', 'provider', 'geminiApiKey', 'autoStart', 'showConfidence'],
        settings => sendResponse({ success: true, settings })
      );
      return true;
    }

    // Popup toggling the extension on/off
    case 'SET_ENABLED': {
      chrome.storage.sync.set({ enabled: payload.enabled }, () => {
        // Notify all YouTube tabs
        chrome.tabs.query({ url: 'https://www.youtube.com/*' }, tabs => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              type: 'EXTENSION_TOGGLE',
              enabled: payload.enabled
            }).catch(() => {});
          });
        });
        sendResponse({ success: true });
      });
      return true;
    }

    // Clear all caches
    case 'CLEAR_CACHE': {
      chrome.storage.local.get(null, items => {
        const fcKeys = Object.keys(items).filter(k => k.startsWith('fc_'));
        chrome.storage.local.remove(fcKeys, () => {
          console.log(`[SachMei SW] Cleared ${fcKeys.length} cached results.`);
          sendResponse({ success: true, cleared: fcKeys.length });
        });
      });
      return true;
    }

    // Abort in-flight requests for a video (video changed)
    case 'ABORT_VIDEO_REQUESTS': {
      const { videoId } = payload;
      console.log(`[SachMei SW] Aborting requests for video: ${videoId}`);
      // In-flight requests are let finish but their results won't be used
      // (content script tracks current videoId and discards stale results)
      sendResponse({ success: true });
      return false;
    }

    default:
      console.warn('[SachMei SW] Unknown message type:', type);
  }
});

// ─────────────────────────────────────────────
// Extension install / update handler
// ─────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    // Set defaults
    chrome.storage.sync.set({
      enabled: true,
      provider: 'mock',
      autoStart: true,
      showConfidence: true,
      geminiApiKey: '',
    });
    console.log('[SachMei] Extension installed. Welcome to SachMei!');
  }
});

console.log('[SachMei] Service worker loaded.');
