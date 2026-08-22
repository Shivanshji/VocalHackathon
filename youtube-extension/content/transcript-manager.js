/**
 * transcript-manager.js — Manages transcript state and timestamp sync.
 */

class TranscriptManager {
  constructor({ onClaimDetected, onStatusChange, onTranscriptLoaded }) {
    this._onClaimDetected = onClaimDetected || (() => {});
    this._onStatusChange  = onStatusChange  || (() => {});
    this._onTranscriptLoaded = onTranscriptLoaded || (() => {});

    this._videoId = null;
    this._segments = [];
    this._isLoaded = false;
    this._isEnabled = false;
    this._isLiveMode = false;
    this._processedUntil = 0;
    this._seekThreshold = 5;

    this._pollInterval = null;
    this._POLL_RATE_MS = 1000;

    this._debounceTimer = null;
    this._DEBOUNCE_MS = 400;
  }

  // ─── Lifecycle ──────────────────────────────────────────────

  async init(videoId) {
    console.log(`[SachMei TM] init(${videoId})`);
    this._reset();
    this._videoId = videoId;

    this._onStatusChange({ type: 'LOADING_TRANSCRIPT' });

    try {
      const result = await transcriptService.getTranscript(videoId, true);

      this._segments    = result.segments;  // shared reference — grows if live
      this._isLiveMode  = result.isLive || false;
      this._isLoaded    = true;

      // In live mode, start processing from current video time (not 0)
      if (this._isLiveMode) {
        const v = smGetVideo ? smGetVideo() : document.querySelector('video');
        this._processedUntil = Math.max(0, (v?.currentTime || 0) - 0.5);
        console.log(`[SachMei TM] Live DOM mode. processedUntil=${this._processedUntil.toFixed(1)}s`);
        this._onStatusChange({ type: 'TRANSCRIPT_LOADED', count: 0, strategy: 'LiveDOM (watching CC)' });
      } else {
        console.log(`[SachMei TM] Loaded ${this._segments.length} segs via ${result.strategy}`);
        this._onStatusChange({ type: 'TRANSCRIPT_LOADED', count: this._segments.length, strategy: result.strategy });
      }

      this._onTranscriptLoaded({ segments: this._segments, videoId });
      if (this._isEnabled) this._startPolling();

    } catch(err) {
      console.error('[SachMei TM] getTranscript failed:', err.message);
      this._onStatusChange({ type: 'NO_TRANSCRIPT', error: err.message });
    }
  }

  enable() {
    this._isEnabled = true;
    if (this._isLoaded) this._startPolling();
    console.log('[SachMei TM] enabled');
  }

  disable() {
    this._isEnabled = false;
    this._stopPolling();
    console.log('[SachMei TM] disabled');
  }

  _reset() {
    this._stopPolling();
    transcriptService.reset();
    claimDetector.reset();
    sachMeiCache.clear();

    this._videoId       = null;
    this._segments      = [];
    this._isLoaded      = false;
    this._isLiveMode    = false;
    this._processedUntil = 0;

    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
  }

  // ─── Polling ────────────────────────────────────────────────

  _startPolling() {
    if (this._pollInterval) return;
    console.log('[SachMei TM] polling started');
    this._pollInterval = setInterval(() => this._tick(), this._POLL_RATE_MS);
  }

  _stopPolling() {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }

  _tick() {
    if (!this._isLoaded) return;

    const video = (window._sachMeiGetVideo && window._sachMeiGetVideo()) ||
      document.querySelector('video.html5-main-video') ||
      document.querySelector('video.video-stream') ||
      document.querySelector('ytd-shorts video') ||
      document.querySelector('video');

    if (!video) return;

    const isShorts = location.href.includes('/shorts/');
    if (video.paused && !isShorts) return;

    const t = video.currentTime;
    if (!t || t < 0) return;

    if (this._isLiveMode) {
      // Live: pick up any new DOM-captured segment
      const fresh = this._segments.filter(s => s.start > this._processedUntil);
      if (!fresh.length) return;
      for (const seg of fresh) {
        const r = claimDetector.processSegment(seg);
        if (r?.shouldCheck) this._scheduleClaim(r);
      }
      this._processedUntil = fresh[fresh.length - 1].start;
      return;
    }

    // Pre-loaded mode: detect seeks
    const drift = Math.abs(t - this._processedUntil);
    if (drift > this._seekThreshold * 2) {
      this._processedUntil = Math.max(0, t - 1);
      claimDetector.reset();
      return;
    }

    const fresh = this._segments.filter(s => s.start >= this._processedUntil && s.start <= t);
    if (!fresh.length) return;

    for (const seg of fresh) {
      const r = claimDetector.processSegment(seg);
      if (r?.shouldCheck) this._scheduleClaim(r);
    }
    this._processedUntil = t;
  }

  _scheduleClaim(claimResult) {
    const { claim, startTime, endTime, signals } = claimResult;
    console.log(`[SachMei TM] claim @ ${formatTimestamp(startTime)}: "${truncate(claim, 80)}"`);

    this._onClaimDetected({
      claim,
      context: this._buildContext(startTime),
      videoId: this._videoId,
      timestamp: startTime,
      endTimestamp: endTime,
      signals,
    });
  }

  _buildContext(centerTime) {
    const w = getSegmentsInWindow(this._segments, centerTime - 30, centerTime + 10);
    return w.map(s => s.text).join(' ').substring(0, 500);
  }

  // ─── Getters ────────────────────────────────────────────────

  get isLoaded()     { return this._isLoaded; }
  get videoId()      { return this._videoId; }
  get segmentCount() { return this._segments.length; }

  getSegmentsAround(timestamp, windowSec = 30) {
    return extractContextWindow(this._segments, timestamp, windowSec);
  }
}

// Helper — also used by transcript-service.js LiveDomStrategy
function smGetVideo() {
  return (window._sachMeiGetVideo && window._sachMeiGetVideo()) ||
    document.querySelector('video.html5-main-video') ||
    document.querySelector('video.video-stream') ||
    document.querySelector('ytd-shorts video') ||
    document.querySelector('video');
}
