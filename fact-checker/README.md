# 🔍 P3 Fact-Check Engine

**Real-time, evidence-grounded claim verification with calculated confidence scoring.**

Part of the **Indic Video Fact-Checker** pipeline — receives spoken claims (translated to English) from P2's audio pipeline, verifies them against live web evidence from authoritative sources, and returns timestamped, confidence-scored verdicts to P1's Chrome extension overlay.

---

## 📐 Architecture

### System Context — Where P3 Fits

```
┌──────────────────────────────────────────────────────────────────────┐
│                    INDIC VIDEO FACT-CHECKER                         │
│                                                                     │
│  ┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐  │
│  │ P2 — Audio  │     │  P3 — Fact-Check  │     │ P1 — Chrome     │  │
│  │   Pipeline  │────▶│     Engine        │────▶│   Extension     │  │
│  │             │     │   (this repo)     │     │                 │  │
│  │ • Indic ASR │     │ • Verify claims   │     │ • Overlay UI    │  │
│  │ • Translate │     │ • Web evidence    │     │ • Timeline      │  │
│  │ • Route     │     │ • Confidence      │     │ • Verdicts      │  │
│  └─────────────┘     └──────────────────┘     └─────────────────┘  │
│                                                                     │
│    Routed Claim JSON ──▶  Verdict JSON  ──▶  Visual overlay         │
└──────────────────────────────────────────────────────────────────────┘
```

### Internal Pipeline — 7-Step Verification

```
   ┌──────────────────────────────────────────────────────────────┐
   │                   POST /fact-check                           │
   │                   (P2's Claim JSON)                          │
   └──────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
   ┌──────────────────────────┐
   │   ① CACHE CHECK          │  ◀── Redis: canonical_claim → result
   │   Hit? Return cached.    │      (1-hour TTL)
   └──────────┬───────────────┘
              │ miss
              ▼
   ┌──────────────────────────┐
   │   ② NORMALIZE            │  ◀── Gemini LLM
   │   Raw speech → clean     │
   │   canonical claim        │      "so basically India's
   │                          │       unemployment has fallen
   │                          │       to about two percent"
   │                          │             ↓
   │                          │      "India's unemployment
   │                          │       rate is 2%."
   └──────────┬───────────────┘
              │
              ▼
   ┌──────────────────────────┐
   │   ③ DECOMPOSE            │  ◀── Gemini LLM
   │   Compound → atomic      │
   │   sub-claims             │      "GDP grew 7% and
   │                          │       unemployment fell to 3%"
   │                          │             ↓
   │                          │      ["GDP grew 7%.",
   │                          │       "Unemployment fell to 3%."]
   └──────────┬───────────────┘
              │
              ▼  (for each sub-claim)
   ┌──────────────────────────┐
   │   ④ QUERY GENERATION     │  ◀── Gemini LLM
   │   Dual-sided queries:    │
   │   • Supporting queries   │      "India unemployment 2%"
   │   • Contradicting queries│      "India real unemployment rate"
   └──────────┬───────────────┘
              │
              ▼
   ┌──────────────────────────┐
   │   ⑤ WEB SEARCH           │  ◀── Tavily API
   │   8-10 results per query │
   │   Full metadata + raw    │      Returns: title, URL, content,
   │   content retained       │      score, raw_content
   └──────────┬───────────────┘
              │
              ▼
   ┌──────────────────────────┐
   │   ⑥ SOURCE RANKING       │  ◀── Deterministic policy
   │   5-tier domain authority │
   │                          │      Tier 1 (0.97): gov.in, reuters
   │   Score: 0.0 → 1.0      │      Tier 2 (0.85): thehindu, snopes
   │   Sorted by quality      │      Tier 3 (0.70): forbes, wikipedia
   └──────────┬───────────────┘      Tier 4 (0.50): general web
              │                      Tier 5 (0.25): blogs, unknown
              ▼
   ┌──────────────────────────┐
   │   ⑦ EVIDENCE EXTRACTION  │  ◀── Gemini LLM
   │   Extract relevant text  │
   │   + label stance:        │      "supports" / "contradicts"
   │     supports/contradicts │        / "neutral"
   │     /neutral             │
   └──────────┬───────────────┘
              │
              ▼
   ┌──────────────────────────┐
   │   ⑦b RELEVANCE SCORING   │  ◀── Sentence-Transformers
   │   Cosine similarity:     │      (all-MiniLM-L6-v2)
   │   claim ↔ evidence       │
   │   Score: 0.0 → 1.0      │      Local model, no API cost
   └──────────┬───────────────┘
              │
              ▼
   ┌──────────────────────────┐
   │   ⑧ VERIFICATION         │  ◀── Gemini LLM
   │   Synthesize all evidence │
   │   into final verdict:    │      SUPPORTED
   │                          │      CONTRADICTED
   │                          │      MISLEADING
   │                          │      INSUFFICIENT_EVIDENCE
   └──────────┬───────────────┘
              │
              ▼
   ┌──────────────────────────┐
   │   ⑨ CONFIDENCE CALC      │  ◀── Formula (NOT LLM-guessed)
   │                          │
   │   confidence =           │      source_quality  (0.30)
   │     (w1·quality +        │      relevance       (0.30)
   │      w2·relevance +      │      agreement       (0.40)
   │      w3·agreement)       │      × volume_factor
   │     × volume_factor      │
   └──────────┬───────────────┘
              │
              ▼
   ┌──────────────────────────┐
   │   CACHE + PERSIST         │  Redis cache + PostgreSQL
   └──────────┬───────────────┘
              │
              ▼
   ┌──────────────────────────┐
   │   RESPONSE                │  Verdict JSON → P1
   └──────────────────────────┘
```

---

## 🧠 What We Built vs. What APIs Gave Us

| What APIs gave us (raw ingredients) | What we built (the new part) |
|-------------------------------------|------------------------------|
| LLM text generation (Gemini) | Claim normalization prompts & pipeline |
| Web search results (Tavily) | Dual-sided retrieval strategy (support + contradict) |
| Embedding vectors (Sentence-Transformers) | Evidence-claim relevance scoring |
| — | Compound claim decomposition into atomic sub-claims |
| — | 5-tier source authority ranking policy |
| — | Multi-signal confidence formula (not LLM-guessed) |
| — | Full pipeline orchestration & error handling |
| — | P2↔P3↔P1 JSON contract enforcement |

---

## 🔑 Key Design Decisions

### 1. Calculated Confidence (Not LLM-Guessed)

Most fact-checkers ask the LLM "how confident are you?" — this is unreliable because LLMs hallucinate confidence. Our confidence score is **calculated from 4 measurable pipeline signals**:

| Signal | Weight | What it measures |
|--------|--------|-----------------|
| Source Quality | 30% | Average authority tier of evidence sources |
| Relevance | 30% | Semantic similarity between claim and evidence |
| Agreement | 40% | % of sources agreeing on the dominant stance |
| Volume Factor | multiplier | Penalty if fewer than 3 sources found |

This is auditable — you can see exactly why the confidence is what it is.

### 2. Dual-Sided Retrieval

We generate search queries for **both sides** of a claim:
- *Supporting queries*: "India unemployment rate 2%"
- *Contradicting queries*: "India actual unemployment rate statistics"

This prevents confirmation bias — searching only for supporting evidence would miss contradicting data.

### 3. Deterministic Source Ranking

Source quality is scored by a **curated domain tier list**, not by asking an LLM. This makes it:
- **Fast** — no API call needed
- **Auditable** — you can see exactly which tier a domain falls in
- **Consistent** — same domain always gets the same score

### 4. Graceful Degradation

Redis and PostgreSQL are optional:
- **Without Redis**: Every claim hits the full pipeline (no caching)
- **Without PostgreSQL**: Results are returned but not persisted
- **Without Sentence-Transformers**: Falls back to keyword-overlap heuristic

The API works with just Gemini + Tavily API keys.

### 5. Compound Claim Decomposition

Spoken claims are often compound: *"India's GDP grew 7% and unemployment fell to 3%."* We decompose these into independently-verifiable atomic claims before searching — this prevents one true sub-claim from masking a false one.

---

## 📁 Project Structure

```
fact-checker/
├── app/
│   ├── main.py                          # FastAPI entry point, POST /fact-check
│   ├── config.py                        # Pydantic Settings (.env loading)
│   │
│   ├── models/
│   │   ├── input.py                     # P2 → P3 JSON schema
│   │   └── output.py                    # P3 → P1 JSON schema
│   │
│   ├── claim/
│   │   ├── normalize.py                 # LLM: raw text → canonical claim
│   │   └── decompose.py                 # LLM: compound → atomic sub-claims
│   │
│   ├── search/
│   │   ├── query_generator.py           # LLM: claim → dual-sided search queries
│   │   ├── tavily_client.py             # Tavily API wrapper (8-10 results)
│   │   └── source_ranker.py             # Deterministic 5-tier domain scoring
│   │
│   ├── evidence/
│   │   ├── extractor.py                 # LLM: search results → evidence + stance
│   │   └── relevance.py                 # Sentence-Transformers cosine similarity
│   │
│   ├── verification/
│   │   ├── verifier.py                  # LLM: evidence → verdict
│   │   └── confidence.py                # Formula: 4 signals → confidence score
│   │
│   ├── cache/
│   │   └── redis_cache.py               # Redis cache (graceful fallback)
│   │
│   └── database/
│       ├── postgres.py                  # SQLAlchemy async engine + ORM
│       └── repositories.py              # CRUD operations
│
├── tests/
│   ├── test_claim.py                    # 5 tests: normalize + decompose
│   ├── test_search.py                   # 7 tests: source ranking + query gen
│   ├── test_verification.py             # 8 tests: confidence + verifier
│   └── test_pipeline.py                 # 3 tests: full e2e integration
│
├── evaluation/
│   ├── dataset.json                     # 20 hand-labelled claims
│   └── evaluate.py                      # Eval harness → accuracy metrics
│
├── .env.example                         # Required: GEMINI_API_KEY, TAVILY_API_KEY
├── requirements.txt                     # Python dependencies
├── docker-compose.yml                   # PostgreSQL + Redis containers
└── pytest.ini                           # Test configuration
```

---

## 📋 API Contracts

### Input: P2 → P3 (POST /fact-check)

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

### Output: P3 → P1 (Response)

```json
{
  "session_id": "abc123",
  "segment_id": "seg_28",
  "start": 84.3,
  "end": 89.1,
  "original_text": "India's unemployment rate has fallen to two percent.",
  "canonical_claim": "India's unemployment rate is 2%.",
  "sub_claims": null,
  "verdict": "CONTRADICTED",
  "confidence": 0.82,
  "explanation": "Official government data and CMIE reports show India's unemployment rate is approximately 7.8%, not 2%. Multiple authoritative sources contradict the stated figure.",
  "evidence": [
    {
      "title": "CMIE Unemployment Data",
      "url": "https://www.cmie.com/unemployment",
      "source_quality": 0.85,
      "stance": "contradicts",
      "text": "India's unemployment rate stood at 7.8% in October 2023.",
      "relevance_score": 0.91
    }
  ],
  "checked_at": "2026-08-21T18:20:00+00:00",
  "status": "verified"
}
```

> `session_id`, `segment_id`, `start`, `end` are preserved end-to-end — P1 needs them to anchor verdict overlays to the video timeline.

---

## 🚀 Quick Start

### 1. Install dependencies

```bash
cd fact-checker
pip install -r requirements.txt
```

### 2. Set API keys

```bash
cp .env.example .env
# Edit .env:
#   GEMINI_API_KEY=your-real-key
#   TAVILY_API_KEY=your-real-key
```

### 3. Run the server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API is now live at `http://localhost:8000`. 

- **Docs**: http://localhost:8000/docs (auto-generated Swagger UI)
- **Health**: http://localhost:8000/health

### 4. Test with a real claim

```bash
curl -X POST http://localhost:8000/fact-check ^
  -H "Content-Type: application/json" ^
  -d "{\"session_id\":\"demo\",\"segment_id\":\"seg_1\",\"start\":0,\"end\":5,\"english_text\":\"India's unemployment rate is 2 percent\",\"should_fact_check\":true,\"statement_type\":\"factual_claim\",\"routing_reason\":\"Economic claim\"}"
```

### 5. Optional: Redis + PostgreSQL

```bash
docker-compose up -d    # Starts Redis + Postgres containers
```

---

## 🧪 Testing

### Run all tests

```bash
python -m pytest tests/ -v
```

```
23 passed ✅
```

### Test breakdown

| Test File | Tests | What's covered |
|-----------|-------|----------------|
| `test_claim.py` | 5 | Normalization, unverifiable detection, JSON fallback, decomposition |
| `test_search.py` | 7 | Source ranking (all tiers), ordering, query generation, fallback |
| `test_verification.py` | 8 | Confidence calc (5 scenarios), verdict synthesis, fallback |
| `test_pipeline.py` | 3 | Full e2e integration, health check, skip non-factual |

All tests use **mocked LLM/API calls** — no real API keys needed.

### Run evaluation harness

```bash
# With the server running on port 8000:
python -m evaluation.evaluate --verbose
```

Evaluates the pipeline against **20 hand-labelled claims** across:
- Economics, demographics, politics, geography, science, sports
- All verdict types (SUPPORTED, CONTRADICTED, MISLEADING)

Reports: accuracy, per-verdict breakdown, avg confidence, avg latency.

---

## ⚙️ Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| API Framework | FastAPI | Async, auto-docs, Pydantic validation |
| LLM | Google Gemini (gemini-2.0-flash) | Free tier, fast, strong reasoning |
| Web Search | Tavily | Structured results with full metadata |
| Embeddings | Sentence-Transformers (all-MiniLM-L6-v2) | Local, fast, no API cost |
| Cache | Redis | Low-latency claim-level caching |
| Database | PostgreSQL + SQLAlchemy | Persistent audit trail |
| Testing | pytest + pytest-asyncio | Async test support |

---

## 🛡️ Declared Constraints (from the hackathon brief)

1. **Two models genuinely cooperating** — P2's ASR/translation model produces structured routing decisions that P3's verification LLM acts on. Neither is "one model called twice."

2. **Handle being wrong** — explicit `INSUFFICIENT_EVIDENCE` verdict when evidence is weak. Confidence is **calculated** from source quality, relevance, agreement, and volume — not LLM self-reported.

---

## 📊 Confidence Score Breakdown

Every verdict includes a transparency breakdown:

```json
{
  "confidence": 0.82,
  "breakdown": {
    "source_quality": 0.87,
    "relevance": 0.85,
    "agreement": 1.0,
    "volume_factor": 1.0,
    "evidence_count": 4
  }
}
```

| Component | Range | Meaning |
|-----------|-------|---------|
| `source_quality` | 0–1 | Average authority of evidence sources |
| `relevance` | 0–1 | How semantically close evidence is to the claim |
| `agreement` | 0–1 | % of sources that agree (1.0 = unanimous) |
| `volume_factor` | 0–1 | Penalty if < 3 sources (1.0 = enough sources) |

---

*Built for the Indic Video Fact-Checker hackathon project.*
