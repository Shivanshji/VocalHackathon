# Architecture — P3 Fact-Check Engine

> Technical deep-dive for mentor walkthroughs and code reviews.

---

## 1. Design Philosophy

Three principles drive every decision:

1. **Evidence-grounded, not LLM-trusted** — The LLM extracts and synthesizes, but confidence is calculated from measurable signals. We never trust `"I'm 90% sure"` from a model.

2. **Dual-sided retrieval** — Every claim triggers both supporting AND contradicting search queries. Single-sided search creates confirmation bias; dual-sided search surfaces the actual truth.

3. **Graceful degradation** — Redis down? Skip caching. Postgres down? Skip persistence. Sentence-Transformers not installed? Use keyword overlap. The core pipeline only hard-requires Gemini + Tavily.

---

## 2. Data Flow

### Request Lifecycle

```
P2 sends POST /fact-check with ClaimInput JSON
│
├─ FastAPI validates against Pydantic ClaimInput schema
│  (rejects malformed requests with 422)
│
├─ Guard: if should_fact_check == false → return INSUFFICIENT_EVIDENCE immediately
│
├─ Redis cache lookup on canonical_claim (after normalization)
│  ├─ HIT  → return cached result (status: "cached")
│  └─ MISS → continue pipeline
│
├─ Pipeline steps 1-9 (see below)
│
├─ Cache store (Redis, non-blocking)
├─ DB persist (PostgreSQL, non-blocking)
│
└─ Return FactCheckResult JSON to P1
```

### Pipeline Steps in Detail

#### Step 1: Normalize (`claim/normalize.py`)
- **Input**: Raw English text (may contain filler, speech artifacts)
- **LLM Prompt**: Instructs Gemini to strip filler, standardize numbers/dates, produce a single declarative sentence
- **Output**: `{ canonical_claim, is_verifiable, reason }`
- **Fallback**: If LLM returns invalid JSON, uses raw text as canonical claim
- **Why separate from decompose**: Normalization must happen first — decomposition operates on clean text

#### Step 2: Decompose (`claim/decompose.py`)
- **Input**: Canonical claim from Step 1
- **LLM Prompt**: Identifies if the claim is compound and splits into atomic sub-claims
- **Output**: `{ sub_claims: [...], is_compound: bool }`
- **Why this matters**: "GDP grew 7% and unemployment fell to 3%" — the GDP part might be true while unemployment is false. Without decomposition, a mixed verdict would obscure the lie.

#### Step 3: Query Generation (`search/query_generator.py`)
- **Input**: One atomic sub-claim
- **LLM Prompt**: Generate 2-3 supporting queries + 2-3 contradicting queries
- **Output**: `{ supporting_queries, contradicting_queries, key_entities, all_queries }`
- **Key insight**: Contradicting queries don't just add "false" — they ask for the *actual data*. E.g., claim "unemployment is 2%" → contradicting query: "India actual unemployment rate statistics"

#### Step 4: Web Search (`search/tavily_client.py`)
- **Input**: All queries from Step 3
- **API**: Tavily `search_depth="advanced"`, `include_raw_content=True`
- **Output**: 8-10 results per query, deduplicated by URL
- **Why Tavily**: Returns structured metadata (title, URL, content, score) + raw page content, not just LLM summaries

#### Step 5: Source Ranking (`search/source_ranker.py`)
- **Input**: Search results from Step 4
- **Method**: Deterministic domain-tier lookup (no LLM call)
- **Output**: Same results with `source_quality` score added, sorted descending
- **Tier list**: 70+ curated domains across 5 tiers:
  ```
  Tier 1 (0.97): gov.in, reuters.com, who.int, worldbank.org
  Tier 2 (0.85): thehindu.com, snopes.com, bbc.com, nature.com
  Tier 3 (0.70): forbes.com, wikipedia.org, bloomberg.com
  Tier 4 (0.50): Unknown/general domains
  Tier 5 (0.25): Blogs, forums (fallback)
  ```
- **Also checks TLDs**: `.gov` → Tier 1, `.edu` / `.ac.in` → Tier 2

#### Step 6: Evidence Extraction (`evidence/extractor.py`)
- **Input**: Ranked search results + the claim
- **LLM Prompt**: For each result, extract the most relevant passage and label stance
- **Output**: List of `{ title, url, text, stance, reasoning, source_quality }`
- **Content truncation**: Each result's content is capped at 1500 chars to avoid token limits

#### Step 6b: Relevance Scoring (`evidence/relevance.py`)
- **Input**: Claim text + evidence items
- **Method**: Sentence-Transformers `all-MiniLM-L6-v2` (22M params)
- **Computation**: Encode claim + all evidence in one batch → cosine similarity
- **Fallback**: If library unavailable, uses Jaccard keyword overlap
- **Why local model**: No API cost, fast (~80ms per batch), deterministic

#### Step 7: Verification (`verification/verifier.py`)
- **Input**: Claim + all evidence (sorted by source quality)
- **LLM Prompt**: Synthesize evidence into verdict with explanation
- **Output**: `{ verdict, explanation, key_finding }`
- **Verdict validation**: If LLM returns an invalid verdict (e.g., "MAYBE_TRUE"), defaults to INSUFFICIENT_EVIDENCE

#### Step 8: Confidence Calculation (`verification/confidence.py`)
- **Input**: Evidence items with `source_quality`, `relevance_score`, `stance`
- **Formula**:
  ```
  raw_score = 0.30 × avg(source_quality)
            + 0.30 × avg(relevance_score)
            + 0.40 × agreement_ratio

  confidence = raw_score × volume_factor
  ```
- **Agreement ratio**: `max(supporting, contradicting) / (supporting + contradicting)`
  - All agree → 1.0 (high confidence in verdict direction)
  - 50/50 split → 0.5 (low confidence, uncertain)
  - All neutral → 0.3 (limited actionable evidence)
- **Volume factor**: Linear penalty if < 3 evidence items
  - 3+ items → 1.0 (no penalty)
  - 1 item → ~0.67 (penalized)
  - 0 items → 0.0

---

## 3. Error Handling Strategy

| Failure | Response |
|---------|----------|
| LLM returns invalid JSON | Fallback to raw text / default values |
| Tavily search returns 0 results | Continue with empty evidence → INSUFFICIENT_EVIDENCE verdict |
| LLM returns invalid verdict string | Default to INSUFFICIENT_EVIDENCE |
| Redis connection fails | Skip caching, log warning, continue |
| PostgreSQL connection fails | Skip persistence, log warning, continue |
| Sentence-Transformers not installed | Keyword overlap heuristic |
| Entire pipeline throws | HTTP 500 with error detail |

**Design principle**: Never crash the API. Degrade gracefully and explain what happened in the response.

---

## 4. LLM Usage Map

Five distinct LLM calls per claim (or per sub-claim for compound claims):

| Call # | Module | Purpose | Can fail gracefully? |
|--------|--------|---------|---------------------|
| 1 | `normalize.py` | Canonicalize claim | ✅ Falls back to raw text |
| 2 | `decompose.py` | Split compound claims | ✅ Treats as single atomic claim |
| 3 | `query_generator.py` | Generate search queries | ✅ Uses claim itself as query |
| 4 | `extractor.py` | Extract evidence + stance | ✅ Returns empty evidence list |
| 5 | `verifier.py` | Synthesize verdict | ✅ Returns INSUFFICIENT_EVIDENCE |

**Model**: `gemini-2.0-flash` (configurable via `LLM_MODEL` env var)

All prompts return structured JSON. All JSON parsing has try/except fallbacks.

---

## 5. Caching Strategy

```
                   canonical_claim (lowercased, stripped)
                              │
                              ▼
                   ┌──────────────────┐
                   │   Redis Key:     │
                   │   factcheck:     │
                   │   {claim_text}   │
                   ├──────────────────┤
                   │   Value:         │
                   │   Full result    │
                   │   JSON           │
                   ├──────────────────┤
                   │   TTL: 1 hour    │
                   └──────────────────┘
```

- **Key**: `factcheck:{canonical_claim}` (lowercased)
- **Value**: Full `FactCheckResult` as JSON
- **TTL**: 3600 seconds (1 hour) — claims can become stale
- **Cache hit behavior**: Updates `session_id`, `segment_id`, `start`, `end` from current request (these are per-request metadata, not per-claim)

---

## 6. Database Schema

```sql
CREATE TABLE claims (
    id              SERIAL PRIMARY KEY,
    session_id      VARCHAR(128) NOT NULL,    -- links to P2's session
    segment_id      VARCHAR(128) NOT NULL,    -- links to P2's segment
    start_time      FLOAT NOT NULL,           -- video timestamp
    end_time        FLOAT NOT NULL,
    original_text   TEXT NOT NULL,             -- raw P2 input
    canonical_claim TEXT NOT NULL,             -- normalized claim
    verdict         VARCHAR(32) NOT NULL,     -- SUPPORTED/CONTRADICTED/...
    confidence      FLOAT NOT NULL,           -- calculated score
    explanation     TEXT,
    evidence        JSONB,                    -- array of evidence items
    checked_at      TIMESTAMPTZ DEFAULT NOW(),
    status          VARCHAR(32) DEFAULT 'verified'
);

-- Indexes
CREATE INDEX idx_claims_session ON claims(session_id);
CREATE INDEX idx_claims_canonical ON claims(canonical_claim);
```

---

## 7. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| API keys in code | Loaded from `.env` via Pydantic Settings, never committed |
| CORS wide open | `allow_origins=["*"]` — must lock down for production |
| Prompt injection | Input is P2's translated text, not raw user input; low risk |
| Rate limiting | Not implemented — relies on Tavily/Gemini API rate limits |
| Input validation | Pydantic enforces schema; FastAPI returns 422 for malformed requests |

---

## 8. Performance Characteristics

| Operation | Typical latency | Cost |
|-----------|----------------|------|
| Normalize (LLM) | 1-2s | Gemini API |
| Decompose (LLM) | 1-2s | Gemini API |
| Query Gen (LLM) | 1-2s | Gemini API |
| Tavily Search (per query) | 1-3s | Tavily API |
| Source Ranking | <1ms | None (deterministic) |
| Evidence Extraction (LLM) | 2-3s | Gemini API |
| Relevance Scoring | ~80ms | None (local model) |
| Verification (LLM) | 2-3s | Gemini API |
| Confidence Calc | <1ms | None (formula) |
| **Total (uncached)** | **~10-20s** | **~5 LLM + 4-6 Tavily calls** |
| **Total (cached)** | **<10ms** | **None** |

---

## 9. Scaling Considerations

> From the plan: "Breaks at 10,000 users: Tavily/LLM API rate limits and cost scale linearly."

| Bottleneck | Mitigation |
|-----------|-----------|
| LLM API rate limits | Redis caching on canonical claims (already implemented) |
| Tavily API costs | Cache, batch queries, reduce results-per-query |
| Concurrent requests | FastAPI async handles concurrency; add workers with `--workers N` |
| Database writes | Async SQLAlchemy with connection pooling |
| Embedding model memory | ~100MB RAM for all-MiniLM-L6-v2; shared across requests |
