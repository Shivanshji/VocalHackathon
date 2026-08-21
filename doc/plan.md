# Project Plan — Indic Video Fact-Checker

## 1. One-line pitch
A Chrome extension that watches a video, transcribes and translates Indic-language speech to English, identifies factual claims, verifies them against live web evidence from authoritative sources, and overlays a timestamped, confidence-scored verdict on the video.

**Track:** Multimodal (speech + text + web retrieval) / AI for Bharat (Indic language input)
**Why it couldn't exist 2 years ago:** real-time Indic ASR + translation + LLM-based claim decomposition + evidence-grounded multi-source verification running as one live pipeline wasn't practically assemblable — each piece individually existed, gluing them into a coherent, low-latency, source-audited pipeline is the new part.

## 2. Team split (3 people, matches brief's compulsory "every member speaks" rule)

| Person | Owns | Input | Output |
|---|---|---|---|
| **P1 — Extension/UI** | Chrome extension, timestamped overlay UI | Verdict JSON from P3 | Rendered notes on video timeline |
| **P2 — Audio Pipeline** | Audio capture → Indic ASR → translation → claim routing | Video/audio stream | Routed claim JSON (schema below) |
| **P3 — Fact-Check Engine** | Normalize → decompose → retrieve → rank → verify → confidence | P2's JSON | Verdict JSON (schema below) |

## 3. Pipeline

```
VIDEO/AUDIO
   │
   ▼
[P2] ASR (Indic) → Translation → Claim Routing
   │  emits: routed claim JSON
   ▼
[P3] Normalize → Decompose → Query Gen → Web Retrieval (Tavily)
   → Source Ranking → Evidence Extraction → Support/Contradict
   → Multi-source Agreement → Verdict → Confidence
   │  emits: verdict JSON
   ▼
[P1] Chrome Extension → Timestamped overlay on video
```

## 4. API contracts (lock these first — everyone builds against them in parallel)

**P2 → P3 input:**
```json
{
  "session_id": "abc123",
  "segment_id": "seg_28",
  "start": 84.3,
  "end": 89.1,
  "english_text": "India's unemployment rate has fallen to two percent.",
  "should_fact_check": true,
  "statement_type": "factual_claim",
  "routing_reason": "Contains a measurable claim about India's unemployment rate."
}
```

**P3 → P1 output:**
```json
{
  "session_id": "abc123",
  "segment_id": "seg_28",
  "start": 84.3,
  "end": 89.1,
  "original_text": "...",
  "canonical_claim": "India's unemployment rate is 2%.",
  "verdict": "SUPPORTED | CONTRADICTED | MISLEADING | INSUFFICIENT_EVIDENCE",
  "confidence": 0.91,
  "explanation": "...",
  "evidence": [
    {"title": "...", "url": "...", "source_quality": 0.98, "stance": "contradicts", "text": "..."}
  ],
  "checked_at": "ISO timestamp",
  "status": "verified"
}
```

`session_id`, `segment_id`, `start`, `end` must be preserved end-to-end — P1 needs them to anchor notes to the video timeline.

## 5. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| P3 backend | Python + FastAPI | single `POST /fact-check` endpoint |
| LLM | One API (Claude/GPT/Groq-Llama) | claim normalize, decompose, query-gen, evidence extraction, verdict |
| Web search | Tavily | 8–10 results per query, keep full metadata not just LLM summary |
| Semantic matching | Sentence-Transformers | claim ↔ evidence relevance scoring |
| Cache | Redis | `canonical_claim → result` |
| DB | PostgreSQL | sessions, claims, evidence, verdicts |
| P2 ASR/translation | Whisper (or a hosted Indic ASR) + translation model | ships routed claim JSON over WebSocket/HTTP to P3 |
| P1 extension | Chrome extension (MV3), content script overlay | polls/subscribes to P3 output, renders on video timeline |
| Testing | pytest + 15–20 hand-labelled claims | brief explicitly rewards a small eval harness — cheap points |

## 6. Folder structure

```
fact-checker/
├── app/
│   ├── main.py                    # FastAPI entry point, POST /fact-check
│   ├── models/
│   │   ├── input.py                # P2's JSON schema
│   │   └── output.py               # P1's JSON schema
│   ├── claim/
│   │   ├── normalize.py
│   │   └── decompose.py
│   ├── search/
│   │   ├── query_generator.py
│   │   ├── tavily_client.py
│   │   └── source_ranker.py
│   ├── evidence/
│   │   ├── extractor.py
│   │   └── relevance.py
│   ├── verification/
│   │   ├── verifier.py
│   │   └── confidence.py
│   ├── cache/redis_cache.py
│   ├── database/{postgres.py, repositories.py}
│   └── config.py
├── tests/
│   ├── test_claim.py
│   ├── test_search.py
│   ├── test_verification.py
│   └── test_pipeline.py
├── evaluation/
│   ├── dataset.json                 # 15–20 labelled claims
│   └── evaluate.py
├── extension/                       # P1's Chrome extension (separate concern)
│   ├── manifest.json
│   ├── content_script.js
│   └── overlay.css
├── audio_pipeline/                  # P2's ASR/translation/routing service
│   └── ...
├── .env.example
├── requirements.txt
├── README.md
└── docker-compose.yml               # postgres + redis
```

**Build in this order (P3), don't scaffold everything at once:**
`main.py` → `models/` → `claim/normalize.py` → `search/query_generator.py` + `tavily_client.py` → `evidence/extractor.py` → `verification/verifier.py`. Get one claim flowing end-to-end before adding source ranking, embeddings, Redis, Postgres, eval harness.

## 7. Declared constraints (brief requires exactly 2)

1. **Two models genuinely cooperating** — Indic ASR/translation model (P2) hands off structured routing decisions to the verification LLM (P3); neither is "one model called twice." Also counts as two modalities: audio input + web/text evidence retrieval.
2. **Handle being wrong** — explicit `INSUFFICIENT_EVIDENCE` verdict and a calculated (not LLM-guessed) confidence score combining source quality, evidence relevance, source agreement, and claim clarity. No result is presented as certain when evidence is weak or conflicting.

## 8. Timeline (mapped to compulsory checkpoints)

- **H0–H2:** Repo scaffold, lock P2↔P3↔P1 JSON contracts, prior-art search (find 3 closest existing fact-checkers, write 1-line differentiator).
- **H2–H3:** Pitch locked, mentor-approved. No pivots after.
- **H3–H6:** Each person builds their track in parallel against the locked contracts.
- **H6:** Checkpoint 1 — explain the full pipeline to a mentor without opening the editor.
- **H6–H12:** Wire P2→P3→P1 into one real end-to-end claim flowing through.
- **H12:** Curveball hits — clean module boundaries (especially the JSON contracts) make this absorbable fast.
- **H12–H18:** Add source ranking, multi-source agreement, confidence calc, eval harness (15–20 cases).
- **H18:** Checkpoint 2 — must run live on a real video, not mocked data.
- **H18–H22:** Rehearse demo, write architecture diagram + honest failure log. No UI polish — it's worth zero points.
- **H22:** Code freeze, commit hash recorded.

## 9. Five-questions draft answers

1. **Who has this problem:** someone watching a regional-language news/political video who wants to know, in real time, which spoken claims are actually supported by evidence.
2. **Non-obvious hard part:** decomposing compound spoken claims into atomic, independently-checkable claims, and calculating confidence from pipeline signals rather than trusting an LLM's self-reported confidence.
3. **Built vs. API gave us:** APIs gave raw ASR, translation, LLM completions, and web search results. Built: the routing contract between services, claim decomposition, dual support/contradiction retrieval, source-quality ranking policy, and the confidence formula.
4. **Breaks without AI:** no claim extraction, no evidence retrieval, no verdict — the entire pipeline is AI-dependent end to end.
5. **Breaks at 10,000 users:** Tavily/LLM API rate limits and cost scale linearly with claims-per-video; would need caching on canonical claims (already planned via Redis) and batching claim verification across concurrent sessions.