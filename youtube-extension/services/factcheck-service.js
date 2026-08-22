/**
 * factcheck-service.js — Content-script-side fact-check service.
 *
 * This module is the bridge between the content script and the service worker.
 * It handles:
 *   - Request deduplication (in-flight)
 *   - Local in-memory cache lookup (fast path)
 *   - Dispatching to the service worker for API calls
 *   - Request abortion on video change
 *
 * The actual API/provider logic lives in service-worker.js.
 * This ensures API keys are never accessible to content scripts (XSS safety).
 */

class FactCheckService {
  constructor() {
    this._inFlight = new Map();    // hash → { promise, abortSignal }
    this._currentVideoId = null;
    this._requestCount = 0;
    this._errorCount = 0;
  }

  /**
   * Fact-check a claim. Returns a Promise resolving to the fact-check result.
   *
   * @param {Object} claimData
   * @param {string} claimData.claim - the clean factual claim text
   * @param {string} claimData.context - surrounding context
   * @param {string} claimData.videoId
   * @param {number} claimData.timestamp - video timestamp in seconds
   * @returns {Promise<FactCheckResultData>}
   */
  async checkClaim(claimData) {
    const { claim, videoId } = claimData;
    const hash = hashClaim(claim);

    // 1. Check local in-memory cache first (fastest path)
    const cached = sachMeiCache.get(hash);
    if (cached) {
      console.log(`[SachMei FC] Local cache hit: "${truncate(claim, 50)}"`);
      return { ...cached, fromCache: true };
    }

    // 2. Dedup in-flight requests
    if (this._inFlight.has(hash)) {
      console.log(`[SachMei FC] Dedup in-flight request for: "${truncate(claim, 50)}"`);
      return this._inFlight.get(hash).promise;
    }

    // 3. Dispatch to service worker
    const promise = this._sendToServiceWorker(hash, claimData, videoId);
    this._inFlight.set(hash, { promise });

    try {
      const result = await promise;
      sachMeiCache.set(hash, claim, result);
      return result;
    } finally {
      this._inFlight.delete(hash);
    }
  }

  /**
   * Send claim to service worker for processing.
   * @private
   */
  _sendToServiceWorker(hash, claimData, videoId) {
    return new Promise((resolve, reject) => {
      this._requestCount++;

      chrome.runtime.sendMessage(
        { type: 'FACT_CHECK_CLAIM', payload: claimData },
        response => {
          if (chrome.runtime.lastError) {
            this._errorCount++;
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!response) {
            this._errorCount++;
            reject(new Error('No response from service worker'));
            return;
          }
          if (!response.success) {
            this._errorCount++;
            reject(new Error(response.error || 'Fact-check failed'));
            return;
          }

          // Discard result if video changed while request was in-flight
          if (this._currentVideoId && this._currentVideoId !== videoId) {
            reject(new Error('Video changed — result discarded'));
            return;
          }

          resolve(response.result);
        }
      );
    });
  }

  /**
   * Set current video ID. Results for old videos are discarded.
   * @param {string} videoId
   */
  setCurrentVideo(videoId) {
    if (this._currentVideoId !== videoId) {
      this._currentVideoId = videoId;
      // Cancel in-flight requests (they'll reject on video mismatch check)
      this._inFlight.clear();
      console.log(`[SachMei FC] Video changed to: ${videoId}. Cleared in-flight requests.`);
    }
  }

  /**
   * Reset service state on video navigation.
   */
  reset() {
    this._inFlight.clear();
    this._currentVideoId = null;
  }

  /**
   * Get service statistics.
   */
  getStats() {
    return {
      requests: this._requestCount,
      errors: this._errorCount,
      inFlight: this._inFlight.size,
    };
  }
}

// Singleton
const factCheckService = new FactCheckService();
