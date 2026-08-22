/**
 * transcript-service.js — YouTube transcript/caption extraction.
 *
 * Strategy 1: ytInitialPlayerResponse (best — full transcript, any language)
 * Strategy 2: Innertube API
 * Strategy 3: Live DOM observer (fallback — reads on-screen CC in real time)
 */

// ─── Helpers ─────────────────────────────────────────────────

function smDecodeHtml(text) {
  try {
    const t = document.createElement('textarea');
    t.innerHTML = text;
    return t.value;
  } catch (_) {
    return text.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"');
  }
}

function smGetVideo() {
  return (window._sachMeiGetVideo && window._sachMeiGetVideo()) ||
    document.querySelector('video.html5-main-video') ||
    document.querySelector('video.video-stream') ||
    document.querySelector('ytd-shorts video') ||
    document.querySelector('video');
}

function smParseXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  return Array.from(doc.querySelectorAll('text'))
    .map(n => ({
      text: smDecodeHtml((n.textContent||'').replace(/\n/g,' ').trim()),
      start: parseFloat(n.getAttribute('start')||'0'),
      duration: parseFloat(n.getAttribute('dur')||'3'),
    }))
    .filter(s => s.text);
}

function smParseJson3(data) {
  return (data.events||[])
    .filter(e => e.segs && e.segs.length)
    .map(e => ({
      text: e.segs.map(s=>s.utf8||'').join('').replace(/\n/g,' ').trim(),
      start: (e.tStartMs||0)/1000,
      duration: (e.dDurationMs||3000)/1000,
    }))
    .filter(s => s.text);
}

// ─── Strategy 1: ytInitialPlayerResponse ─────────────────────

class PlayerResponseStrategy {
  get name() { return 'PlayerResponse'; }

  _getPlayerData() {
    if (window.ytInitialPlayerResponse) return window.ytInitialPlayerResponse;
    for (const sc of document.querySelectorAll('script:not([src])')) {
      if (!sc.textContent.includes('ytInitialPlayerResponse')) continue;
      const m = sc.textContent.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*(?:var|if|window)/s);
      if (m) { try { return JSON.parse(m[1]); } catch(_) {} }
    }
    return null;
  }

  async extract() {
    const data = this._getPlayerData();
    if (!data) throw new Error('ytInitialPlayerResponse missing');

    const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks?.length) throw new Error('No caption tracks in playerResponse');

    console.log('[SachMei] Caption tracks:', tracks.map(t=>`${t.languageCode}(${t.kind||''})`).join(', '));

    // Prefer English, fall back to any
    const track = tracks.find(t=>t.languageCode==='en'&&t.kind!=='asr')
      || tracks.find(t=>t.languageCode?.startsWith('en'))
      || tracks[0];

    if (!track?.baseUrl) throw new Error('Track has no baseUrl');
    console.log('[SachMei] Using track:', track.languageCode, track.kind||'manual');

    const sep = track.baseUrl.includes('?') ? '&' : '?';

    // Try JSON3 first
    try {
      const r = await fetch(track.baseUrl + sep + 'fmt=json3');
      if (r.ok) {
        const segs = smParseJson3(await r.json());
        if (segs.length) return segs;
      }
    } catch(e) { console.warn('[SachMei] json3 failed:', e.message); }

    // XML fallback
    const r2 = await fetch(track.baseUrl + sep + 'fmt=srv3');
    if (!r2.ok) throw new Error(`Fetch failed: ${r2.status}`);
    return smParseXml(await r2.text());
  }
}

// ─── Strategy 2: Innertube ────────────────────────────────────

class InnertubeStrategy {
  get name() { return 'Innertube'; }

  async extract(videoId) {
    const key = window.ytcfg?.get?.('INNERTUBE_API_KEY');
    if (!key) throw new Error('No INNERTUBE_API_KEY');

    const ctx = window.ytcfg?.get?.('INNERTUBE_CONTEXT') || {
      client: { clientName:'WEB', clientVersion:'2.20240101.00.00', hl:'en', gl:'US' }
    };

    const r = await fetch(`https://www.youtube.com/youtubei/v1/get_transcript?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ context: ctx, params: btoa(`\n\x0b${videoId}`) }),
    });

    if (!r.ok) throw new Error(`Innertube ${r.status}`);
    const d = await r.json();

    const segs = d?.actions?.[0]
      ?.updateEngagementPanelAction?.content
      ?.transcriptRenderer?.content
      ?.transcriptSearchPanelRenderer?.body
      ?.transcriptSegmentListRenderer?.initialSegments;

    if (!segs?.length) throw new Error('No segments in Innertube response');

    return segs
      .map(s=>s?.transcriptSegmentRenderer)
      .filter(Boolean)
      .map(s=>({
        text: smDecodeHtml((s.snippet?.runs||[]).map(r=>r.text||'').join('')).replace(/\n/g,' ').trim(),
        start: parseInt(s.startMs||'0')/1000,
        duration: Math.max(1, (parseInt(s.endMs||'0')-parseInt(s.startMs||'0'))/1000),
      }))
      .filter(s=>s.text);
  }
}

// ─── Strategy 3: Live DOM caption observer ────────────────────
//
// Instead of waiting for captions, this strategy immediately returns
// an empty growing array, starts a MutationObserver, and populates
// the array in real-time as YouTube shows on-screen captions.
//
// The TranscriptManager's _tick() sees the array growing and feeds
// new segments to the ClaimDetector automatically.

class LiveDomStrategy {
  get name() { return 'LiveDOM'; }

  constructor() {
    this._observer = null;
    this._segments = null;
  }

  async extract() {
    this.disconnect();
    this._segments = [];
    this._start();
    // Return immediately — array grows in background
    return this._segments;
  }

  _start() {
    let lastText = '';

    this._observer = new MutationObserver(() => {
      // All selectors YouTube uses for captions
      const candidates = [
        '.ytp-caption-segment',
        '.ytp-captions-text .ytp-caption-segment',
        '[class*="caption"] span',
        '.subtitles-segment span',
      ];

      let text = '';
      for (const sel of candidates) {
        const els = document.querySelectorAll(sel);
        if (els.length) {
          text = Array.from(els).map(e=>e.textContent||'').join(' ').replace(/\s+/g,' ').trim();
          if (text) break;
        }
      }

      if (!text || text === lastText) return;
      lastText = text;

      const video = smGetVideo();
      const t = video?.currentTime ?? 0;

      this._segments.push({ text, start: t, duration: 4, source: 'dom' });
      console.log(`[SachMei DOM] "${text.substring(0,60)}" @ ${t.toFixed(1)}s`);
    });

    // Observe entire document for caption changes
    this._observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    console.log('[SachMei] LiveDomStrategy: watching for on-screen captions. Enable CC if none appear.');
  }

  disconnect() {
    this._observer?.disconnect();
    this._observer = null;
  }
}

// ─── TranscriptService ────────────────────────────────────────

class TranscriptService {
  constructor() {
    this._strategies = [
      new PlayerResponseStrategy(),
      new InnertubeStrategy(),
      new LiveDomStrategy(),
    ];
    this._liveStrategy = this._strategies[2]; // keep ref for disconnect
    this._cached = null;
    this._cachedVideoId = null;
    this._lastErrors = [];
  }

  async getTranscript(videoId, force = false) {
    if (!force && this._cachedVideoId === videoId && this._cached) {
      return this._cached;
    }

    this._lastErrors = [];
    const errors = [];

    for (const s of this._strategies) {
      try {
        console.log(`[SachMei] Transcript strategy: ${s.name}`);
        const segments = await s.extract(videoId);
        const isLive = s instanceof LiveDomStrategy;

        // For live mode we accept an empty array (it will fill up)
        if (!isLive && (!segments || segments.length === 0)) {
          throw new Error('0 segments returned');
        }

        console.log(`[SachMei] ✓ ${s.name}: ${segments.length} segments (isLive=${isLive})`);
        const result = { segments, strategy: s.name, videoId, isLive };
        this._cached = result;
        this._cachedVideoId = videoId;
        return result;

      } catch(e) {
        console.warn(`[SachMei] ✗ ${s.name}:`, e.message);
        errors.push(`[${s.name}] ${e.message}`);
      }
    }

    this._lastErrors = errors;
    throw new Error('All strategies failed:\n' + errors.join('\n'));
  }

  reset() {
    if (this._liveStrategy) this._liveStrategy.disconnect();
    this._cached = null;
    this._cachedVideoId = null;
    this._lastErrors = [];
  }

  get lastErrors() { return this._lastErrors; }
}

// Singleton
const transcriptService = new TranscriptService();
