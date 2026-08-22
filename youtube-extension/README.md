# SachMei — Live YouTube Fact Checker

> **Real-time AI-powered fact-checking for YouTube videos.**  
> Detects factual claims in video transcripts and verifies them instantly — no microphone, no audio recording, no speech-to-text.

---

## Table of Contents

1. [Architecture Overview & Diagrams (ARCHITECTURE.md)](ARCHITECTURE.md)
2. [Installation](#installation)
3. [How to Load the Extension in Chrome](#how-to-load-in-chrome)
4. [Permissions Explained](#permissions-explained)
5. [Transcript Extraction](#transcript-extraction)
6. [Fact-Checking Pipeline](#fact-checking-pipeline)
7. [Caching System](#caching-system)
8. [Adding a Real Fact-Check Provider](#adding-a-real-fact-check-provider)
9. [Project Structure](#project-structure)
10. [Known Limitations](#known-limitations)
11. [Future Improvements](#future-improvements)

---

## Architecture Overview

```
YouTube Video
      ↓
Detect Video ID + Navigation Change
      ↓
Extract YouTube Transcript (3 strategy fallbacks)
      ↓
Monitor video.currentTime (1s polling)
      ↓
Map timestamp → transcript segments
      ↓
Accumulate text into sentence-sized chunks
      ↓
ClaimDetector: heuristic factual signal scoring
      ↓
Hash claim → check cache → skip if duplicate
      ↓
Send to Service Worker → FactCheckProvider
      ↓
Display verdict overlay on YouTube page
```

### Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| `youtube-content.js` | Orchestrator: navigation detection, state mgmt, module wiring |
| `transcript-manager.js` | Transcript state, timestamp polling, claim scheduling |
| `transcript-service.js` | YouTube caption extraction (3 strategies) |
| `claim-detector.js` | Text accumulation, factual heuristics, deduplication |
| `factcheck-service.js` | Content-side bridge: dedup, cache, SW messaging |
| `cache-service.js` | In-memory per-session cache |
| `service-worker.js` | API calls, persistent cache, provider abstraction |
| `ui-overlay.js` | FAB button, draggable panel, verdict display, history |

---

## Installation

No build step required. This is a pure JavaScript extension.

```bash
# Clone or download the repository
# The extension is ready to load directly
```

---

## How to Load in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer Mode** (toggle in the top-right corner)
3. Click **Load Unpacked**
4. Select the `youtube-extension/` folder
5. The SachMei icon will appear in your Chrome toolbar

To test immediately:
1. Navigate to any YouTube video with English captions
2. Click the **SachMei** floating button (bottom-right of the page)
3. Watch the panel as claims are detected and verified in real-time

---

## Permissions Explained

| Permission | Reason |
|-----------|---------|
| `storage` | Save settings and cache fact-check results |
| `tabs` | Detect the active YouTube tab from the popup |
| `activeTab` | Query current tab status |
| `https://www.youtube.com/*` | Inject content script on YouTube pages |

**No microphone permission.** No audio access. No camera. No recording.

---

## Transcript Extraction

The extension uses YouTube's existing caption/transcript data — **no speech-to-text**.

### Strategy 1: `PlayerResponseStrategy` (Primary)
Reads from `window.ytInitialPlayerResponse`, a global object YouTube injects into every video page. This contains caption track metadata with base URLs to fetch the actual caption XML/JSON.

- Fetches caption track in JSON3 or XML format
- Parses into `{ text, start, duration }` segments
- Works for both manual captions and auto-generated subtitles

### Strategy 2: `InnertubeStrategy` (Fallback)
Uses YouTube's internal Innertube API (`/youtubei/v1/get_transcript`) — the same API the web player itself uses — to fetch the transcript panel data.

### Failure Case
If both strategies fail (video has no captions, or a live stream):

> "No captions are available for this video, so live fact-checking cannot start."

The panel displays this message and waits for the user to navigate to a video with captions.

---

## Fact-Checking Pipeline

```
Transcript Chunk
      ↓
Sentence boundary detection (regex-based)
      ↓
Context accumulation (8–150 words, ≤20 seconds)
      ↓
ClaimDetector.detectClaim():
  - Filter conversational/greeting patterns
  - Filter pure opinions (without factual content)
  - Score factual signals:
    • Statistics/numbers → +0.4
    • Date references → +0.3
    • Named entities → +0.25
    • Factual verbs (launched, discovered…) → +0.2
    • Superlatives (first, largest…) → +0.2
    • Source citations → +0.35
    • Institutions → +0.2
  - Score threshold: 0.3 minimum
      ↓
Deduplication (FNV-1a hash of normalized claim)
      ↓
FactCheckService → chrome.runtime.sendMessage
      ↓
ServiceWorker: cache check → FactCheckProvider.checkClaim()
      ↓
Return { verdict, confidence, explanation, sources }
```

### Verdict Categories

| Verdict | Meaning |
|---------|---------|
| `TRUE` | Claim is factually accurate |
| `FALSE` | Claim is factually incorrect |
| `MISLEADING` | Partially true but omits critical context |
| `PARTIALLY_TRUE` | Some aspects correct, others incorrect |
| `UNVERIFIABLE` | Insufficient evidence to determine |

---

## Caching System

Two-tier caching:

### Layer 1: In-Memory Cache (`CacheService`)
- Per-session, cleared on video navigation
- Max 200 entries, 1-hour TTL
- Fastest path — no messaging overhead

### Layer 2: Persistent Cache (`chrome.storage.local`)
- Survives browser restarts
- 24-hour TTL per entry
- Keys prefixed with `fc_` + FNV-1a hash of normalized claim

### Cache Key
```
claim → lowercase → strip punctuation → collapse whitespace → FNV-1a hash
```

Example:
```
"India launched its first satellite in 1975." 
→ "india launched its first satellite in 1975"
→ hash: "a3f7c91b"
→ storage key: "fc_a3f7c91b"
```

---

## Adding a Real Fact-Check Provider

The provider system in `service-worker.js` is designed for easy extension:

### 1. Create a new provider class

```javascript
class MyProvider extends FactCheckProvider {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
  }

  async checkClaim(claimData) {
    const { claim, context } = claimData;
    // Call your API...
    return new FactCheckResult({
      verdict: 'TRUE',          // TRUE | FALSE | MISLEADING | PARTIALLY_TRUE | UNVERIFIABLE
      confidence: 0.92,         // 0.0 – 1.0
      explanation: '...',
      keyFinding: '...',
      sources: [{ title: '...', url: '...' }],
      canonicalClaim: claim,
    });
  }
}
```

### 2. Register it in `createProvider()`

```javascript
async function createProvider() {
  const settings = await chrome.storage.sync.get(['provider', 'myApiKey']);
  switch (settings.provider) {
    case 'my-provider':
      return new MyProvider(settings.myApiKey);
    // ... existing cases
  }
}
```

### 3. Add it to the options UI

Add a new `<option>` in `options.html` and handle the key input in `options.js`.

### Currently Available Providers

| Provider | Status | Notes |
|----------|--------|-------|
| `MockProvider` | ✅ Ready | Demo mode, cycles through realistic responses |
| `GeminiProvider` | ✅ Ready | Requires Gemini API key |
| `OpenAIProvider` | 🔲 Stub | Easy to implement following GeminiProvider pattern |
| `GoogleFactCheckProvider` | 🔲 Future | Google Fact Check Tools API |
| `RAGProvider` | 🔲 Future | Vector DB + web search |

---

## Project Structure

```
youtube-extension/
├── manifest.json              ← Manifest V3 config
│
├── background/
│   └── service-worker.js      ← API calls, provider abstraction, persistent cache
│
├── content/
│   ├── youtube-content.js     ← Main orchestrator, SPA nav detection
│   ├── transcript-manager.js  ← Transcript state, timestamp polling
│   ├── claim-detector.js      ← Claim detection & deduplication
│   └── ui-overlay.js          ← FAB, panel, verdict display
│
├── popup/
│   ├── popup.html             ← Extension popup
│   ├── popup.js               ← Popup controller
│   └── popup.css              ← Popup styles
│
├── options/
│   ├── options.html           ← Settings page
│   ├── options.js             ← Settings controller
│   └── options.css            ← Settings styles
│
├── services/
│   ├── transcript-service.js  ← YouTube caption extraction (3 strategies)
│   ├── factcheck-service.js   ← Content-side proxy to service worker
│   └── cache-service.js       ← In-memory session cache
│
├── utils/
│   ├── text-utils.js          ← Normalization, hashing, sentence splitting
│   └── timestamp-utils.js     ← Timestamp mapping & formatting
│
├── styles/
│   └── overlay.css            ← YouTube overlay styles (glassmorphism)
│
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
│
└── README.md
```

---

## Known Limitations

1. **Auto-generated captions only in English**: Strategy 1 (PlayerResponseStrategy) prefers English tracks. Videos with only non-English captions will fall back to Strategy 2 or fail gracefully.

2. **Live streams**: YouTube live streams do not have pre-generated transcripts. The extension will display "No captions available" for live content.

3. **Premium/age-restricted videos**: Some videos may not expose caption track URLs to extension content scripts.

4. **Mock provider accuracy**: The MockProvider cycles through sample responses — it does **not** actually fact-check anything. Connect Gemini for real results.

5. **YouTube DOM changes**: YouTube frequently updates its page structure. If `ytInitialPlayerResponse` moves or changes format, Strategy 1 may break and fall back to Strategy 2.

6. **Rate limiting**: The extension rate-limits fact-check calls (3-second cooldown). Very fast speech may miss some claims during the cooldown period.

7. **Claim detection accuracy**: The heuristic claim detector has false positives and false negatives. An AI classifier (e.g., Gemini classification call) would significantly improve precision.

---

## Future Improvements

- [ ] **AI claim detection**: Replace heuristics with a Gemini/Claude call for smarter claim identification
- [ ] **Multi-language support**: Translate non-English captions before claim detection
- [ ] **Tavily / SerpAPI integration**: Real web search for evidence retrieval (like the existing fact-checker backend)
- [ ] **Confidence scoring**: Implement the source quality × relevance × agreement formula from the Python backend
- [ ] **RAG pipeline**: Vector database for fast evidence retrieval
- [ ] **Claim highlighting**: Highlight the current spoken sentence in the YouTube transcript panel
- [ ] **Export results**: Save fact-check report as PDF or JSON
- [ ] **Side panel**: Use Chrome's new Side Panel API for a larger, persistent panel
- [ ] **Speaker diarization**: Identify who is making the claim

---

## Development Notes

### API Key Security
API keys are stored in `chrome.storage.sync` and only accessed in the **service worker** (background context). Content scripts never have direct API key access, preventing XSS exposure.

### Adding Logging
Set `chrome://extensions` → SachMei → "background page" → Console for service worker logs.  
For content script logs: Open YouTube, F12 → Console (filter by `[SachMei]`).

### Testing Without YouTube Captions
Use the MockProvider (default) — it works regardless of whether a transcript loads.

---

*SachMei · AI-powered live fact-checking · Not legal advice · AI outputs may be inaccurate*
