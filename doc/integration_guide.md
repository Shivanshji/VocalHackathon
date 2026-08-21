# P1 & P2 Integration Guide — P3 Fact-Checker

This document outlines the API contracts and specific responsibilities for **Person 1 (Extension/UI)** and **Person 2 (Audio Pipeline)** to integrate with the **Person 3 (Fact-Check Engine)**.

---

## 📡 API Details

* **Base URL**: `http://localhost:8000`
* **Fact-Check Endpoint**: `POST /fact-check` (verifies a claim)
* **Session History Endpoint**: `GET /session/{session_id}/claims` (retrieves all verified claims for a video session)

---

## 🎙️ Person 2 (Audio Pipeline) Integration

P2 processes the video/audio stream, transcribes Indic speech, translates it to English, and classifies segments. 

### 1. Responsibilities
* **Segmenting & Timing**: Assign a unique `segment_id` (e.g. `seg_1`, `seg_2`) and capture start/end video offsets in seconds.
* **Routing**: Set `should_fact_check` to `true` when a factual claim is classified.
* **API Delivery**: Issue an HTTP `POST` request to `http://localhost:8000/fact-check` with the schema below.

### 2. Input Contract (IP)
Defined in [`input.py`]:

| Field | Type | Description |
|---|---|---|
| `session_id` | `str` | Unique video session identifier |
| `segment_id` | `str` | Unique identifier for the audio chunk |
| `start` | `float` | Start time of segment in video (seconds) |
| `end` | `float` | End time of segment in video (seconds) |
| `english_text` | `str` | Translated English text of the spoken segment |
| `should_fact_check` | `bool` | Flag whether P3 should verify this segment |
| `statement_type` | `str` | Classification type (e.g. `factual_claim`) |
| `routing_reason` | `str` | Reasoning for why the segment was routed |

#### Example Payload:
```json
{
  "session_id": "vid_session_992",
  "segment_id": "seg_14",
  "start": 42.5,
  "end": 48.0,
  "english_text": "India's unemployment rate has fallen to two percent.",
  "should_fact_check": true,
  "statement_type": "factual_claim",
  "routing_reason": "Contains a measurable statement about economic rates."
}
```

---

## 🖥️ Person 1 (Extension/UI) Integration

P1 renders the fact-check markers on the video player overlay.

### 1. Responsibilities
* **Visual Anchoring**: Place markers on the video timeline at the returned `start` and `end` times.
* **Stance Color Coding**:
  * `SUPPORTED` → Green
  * `CONTRADICTED` → Red
  * `MISLEADING` → Yellow/Orange
  * `INSUFFICIENT_EVIDENCE` → Gray
* **Hover Details**: Show `canonical_claim`, `explanation`, `confidence`, and links to the source urls under `evidence`.
* **Session Restoration**: When a user loads a video, P1 should fetch history using `GET /session/{session_id}/claims` to display previously verified notes.

### 2. Output Contract (OP)
Defined in [`output.py`]:

| Field | Type | Description |
|---|---|---|
| `session_id` | `str` | Preserved from input |
| `segment_id` | `str` | Preserved from input |
| `start` | `float` | Preserved from input |
| `end` | `float` | Preserved from input |
| `original_text` | `str` | Raw English text sent by P2 |
| `canonical_claim` | `str` | Normalized, clean claim sentence |
| `sub_claims` | `List[str] \| null` | Decomposed atomic sub-claims (if compound) |
| `verdict` | `str` | `SUPPORTED` \| `CONTRADICTED` \| `MISLEADING` \| `INSUFFICIENT_EVIDENCE` |
| `confidence` | `float` | Composite confidence score (0.0 to 1.0) |
| `explanation` | `str` | Detailed synthesis of evidence findings |
| `checked_at` | `str` | ISO UTC timestamp |
| `status` | `str` | `verified` \| `cached` \| `error` |
| `evidence` | `List[Evidence]` | List of sources used for verification |

#### Evidence Item Object:
* `title` (`str`): Page title
* `url` (`str`): Source link
* `source_quality` (`float`): Curated domain authority score (0.0 to 1.0)
* `stance` (`str`): `supports` \| `contradicts` \| `neutral`
* `text` (`str`): Snippet of text extracted from source
* `relevance_score` (`float`): Semantic similarity score (0.0 to 1.0)

#### Example Response:
```json
{
  "session_id": "vid_session_992",
  "segment_id": "seg_14",
  "start": 42.5,
  "end": 48.0,
  "original_text": "India's unemployment rate has fallen to two percent.",
  "canonical_claim": "India's unemployment rate is 2%.",
  "sub_claims": null,
  "verdict": "CONTRADICTED",
  "confidence": 0.82,
  "explanation": "Latest CMIE statistics and Ministry of Labour estimates place India's unemployment rate at approximately 7.8% as of late 2023, refuting the claim of 2%.",
  "evidence": [
    {
      "title": "CMIE Unemployment Rate Index",
      "url": "https://www.cmie.com/unemployment",
      "source_quality": 0.85,
      "stance": "contradicts",
      "text": "India's unemployment rate rose to 7.8% in October.",
      "relevance_score": 0.94
    }
  ],
  "checked_at": "2026-08-22T00:27:22Z",
  "status": "verified"
}
```

---

## 🛠️ Required Code Changes for Final Integration

When combining P1, P2, and P3 codebases, the following changes may be required in our P3 backend code:

### 1. CORS Configuration (P1 Integration)
* **Current state**: CORS is open to all origins (`allow_origins=["*"]`) in [`main.py`].
* **Required change**: chrome-extension scripts run under the `chrome-extension://` origin. If we decide to enforce security, we will need to update the allowed origins block to specifically permit P1's Chrome Extension ID:
  ```python
  allow_origins=["chrome-extension://<extension-id-here>", "http://localhost:3000"]
  ```

### 2. WebSocket Claim Delivery (P2 Integration)
* **Current state**: P3 accepts claims via standard HTTP `POST /fact-check`.
* **Required change**: If P2 switches from batch HTTP POSTs to streaming real-time claims via WebSockets, we will need to add a WebSocket route in [`main.py`]:
  ```python
  from fastapi import WebSocket
  
  @app.websocket("/ws/fact-check")
  async def websocket_endpoint(websocket: WebSocket):
      await websocket.accept()
      # Parse P2 JSON chunks, run P3 pipeline, send back to P1
  ```

### 3. Database and Cache Connections (Deployment)
* **Current state**: Postgres and Redis connection strings use local defaults and degrade gracefully if disconnected.
* **Required change**: During docker-compose or multi-container deployment, connection URLs in `.env` must be updated to target the named services rather than `localhost`:
  ```env
  REDIS_URL=redis://redis:6379/0
  DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/factchecker
  ```

### 4. API Key Rotation for Quota Limits
* **Current state**: Model calls use a single model key loaded from `.env`.
* **Required change**: To prevent 429 errors under heavy user testing, we may need to update [`app/utils/llm.py`] to rotate through a pool of Gemini API keys or transition to a paid plan.

