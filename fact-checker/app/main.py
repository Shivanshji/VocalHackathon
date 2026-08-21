"""
FastAPI entry point — P3 Fact-Check Engine.

Single endpoint: POST /fact-check
Receives P2's routed claim JSON, runs the full pipeline, returns verdict JSON to P1.

Pipeline:
  Input → Cache check → Normalize → Decompose → Query Gen → Web Search →
  Source Ranking → Evidence Extraction → Relevance Scoring → Verification →
  Confidence Calc → Cache store → DB persist → Response
"""

import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.models.input import ClaimInput
from app.models.output import (
    EvidenceItem,
    FactCheckResult,
    Verdict,
    VerificationStatus,
)
from app.claim.normalize import normalize_claim
from app.claim.decompose import decompose_claim
from app.search.query_generator import generate_queries
from app.search.tavily_client import search_multiple
from app.search.source_ranker import rank_sources
from app.evidence.extractor import extract_evidence
from app.evidence.relevance import compute_relevance_scores
from app.verification.verifier import verify_claim
from app.verification.confidence import calculate_confidence
from app.cache.redis_cache import get_cached_result, cache_result
from app.database.postgres import init_db, close_db
from app.database.repositories import save_claim_result

# --- Logging setup ---
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s | %(name)-30s | %(levelname)-7s | %(message)s",
)
logger = logging.getLogger(__name__)


# --- Lifespan ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    logger.info("Starting P3 Fact-Check Engine...")
    await init_db()
    logger.info("Engine ready. Listening for claims.")
    yield
    logger.info("Shutting down...")
    await close_db()


# --- App ---
app = FastAPI(
    title="P3 Fact-Check Engine",
    description=(
        "Receives routed claims from P2's audio pipeline, verifies them against "
        "live web evidence, and returns timestamped, confidence-scored verdicts to P1."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the Chrome extension (P1) to call us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Lock down in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────────────────────────────
# Health check
# ──────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "p3-fact-check-engine"}


# ──────────────────────────────────────────────────────────────────────
# Main endpoint: POST /fact-check
# ──────────────────────────────────────────────────────────────────────

@app.post("/fact-check", response_model=FactCheckResult)
async def fact_check(claim_input: ClaimInput):
    """
    Full fact-check pipeline.

    Receives P2's routed claim JSON, runs normalize → decompose → retrieve →
    rank → extract → verify → confidence, returns verdict JSON to P1.
    """
    start_time = time.time()
    logger.info(
        "━━━ Fact-check request: session=%s segment=%s ━━━",
        claim_input.session_id,
        claim_input.segment_id,
    )
    logger.info("Text: %s", claim_input.english_text[:120])

    # ── Guard: skip if P2 says don't fact-check ──
    if not claim_input.should_fact_check:
        logger.info("Skipped (should_fact_check=false)")
        return FactCheckResult(
            session_id=claim_input.session_id,
            segment_id=claim_input.segment_id,
            start=claim_input.start,
            end=claim_input.end,
            original_text=claim_input.english_text,
            canonical_claim=claim_input.english_text,
            verdict=Verdict.INSUFFICIENT_EVIDENCE,
            confidence=0.0,
            explanation="This segment was not flagged for fact-checking.",
            evidence=[],
            status=VerificationStatus.VERIFIED,
        )

    try:
        # ── Step 1: Normalize ──
        logger.info("Step 1/7: Normalizing claim...")
        norm_result = await normalize_claim(claim_input.english_text)
        canonical = norm_result["canonical_claim"]
        logger.info("Canonical: %s", canonical[:100])

        if not norm_result["is_verifiable"]:
            logger.info("Claim not verifiable: %s", norm_result["reason"])
            return FactCheckResult(
                session_id=claim_input.session_id,
                segment_id=claim_input.segment_id,
                start=claim_input.start,
                end=claim_input.end,
                original_text=claim_input.english_text,
                canonical_claim=canonical,
                verdict=Verdict.INSUFFICIENT_EVIDENCE,
                confidence=0.0,
                explanation=f"Claim is not verifiable: {norm_result['reason']}",
                evidence=[],
                status=VerificationStatus.VERIFIED,
            )

        # ── Cache check ──
        cached = get_cached_result(canonical)
        if cached:
            logger.info("Cache hit — returning cached result")
            # Update session/segment metadata for this specific request
            cached["session_id"] = claim_input.session_id
            cached["segment_id"] = claim_input.segment_id
            cached["start"] = claim_input.start
            cached["end"] = claim_input.end
            cached["original_text"] = claim_input.english_text
            cached["status"] = "cached"
            return FactCheckResult(**cached)

        # ── Step 2: Decompose ──
        logger.info("Step 2/7: Decomposing claim...")
        decomp = await decompose_claim(canonical)
        sub_claims = decomp["sub_claims"]
        logger.info("Sub-claims (%d): %s", len(sub_claims), sub_claims)

        # ── Process each sub-claim (or just the one if atomic) ──
        # For the final verdict, we aggregate evidence from ALL sub-claims
        all_evidence = []

        for i, sub_claim in enumerate(sub_claims):
            logger.info("Processing sub-claim %d/%d: %s", i + 1, len(sub_claims), sub_claim[:80])

            # ── Step 3: Generate queries ──
            logger.info("Step 3/7: Generating search queries...")
            queries = await generate_queries(sub_claim)
            logger.info(
                "Queries: %d supporting + %d contradicting",
                len(queries["supporting_queries"]),
                len(queries["contradicting_queries"]),
            )

            # ── Step 4: Web search ──
            logger.info("Step 4/7: Searching the web...")
            search_results = await search_multiple(
                queries["all_queries"],
                max_results_per_query=5,
            )
            logger.info("Retrieved %d unique search results", len(search_results))

            if not search_results:
                logger.warning("No search results for sub-claim: %s", sub_claim[:80])
                continue

            # ── Step 5: Rank sources ──
            logger.info("Step 5/7: Ranking sources...")
            ranked_results = rank_sources(search_results)

            # ── Step 6: Extract evidence ──
            logger.info("Step 6/7: Extracting evidence...")
            evidence_items = await extract_evidence(sub_claim, ranked_results)
            logger.info("Extracted %d evidence items", len(evidence_items))

            # ── Step 6b: Compute relevance scores ──
            evidence_items = compute_relevance_scores(sub_claim, evidence_items)

            all_evidence.extend(evidence_items)

        # ── Step 7: Verify (using all aggregated evidence) ──
        logger.info("Step 7/7: Verifying claim against %d evidence items...", len(all_evidence))
        verdict_result = await verify_claim(canonical, all_evidence)

        # ── Calculate confidence (NOT LLM-guessed) ──
        conf_result = calculate_confidence(all_evidence)

        # ── Build output ──
        evidence_output = [
            EvidenceItem(
                title=e.get("title", ""),
                url=e.get("url", ""),
                source_quality=round(e.get("source_quality", 0.5), 2),
                stance=e.get("stance", "neutral"),
                text=e.get("text", ""),
                relevance_score=round(e.get("relevance_score", 0.0), 2),
            )
            for e in all_evidence
        ]

        result = FactCheckResult(
            session_id=claim_input.session_id,
            segment_id=claim_input.segment_id,
            start=claim_input.start,
            end=claim_input.end,
            original_text=claim_input.english_text,
            canonical_claim=canonical,
            sub_claims=sub_claims if decomp["is_compound"] else None,
            verdict=Verdict(verdict_result["verdict"]),
            confidence=conf_result["confidence"],
            explanation=verdict_result["explanation"],
            evidence=evidence_output,
            checked_at=datetime.now(timezone.utc).isoformat(),
            status=VerificationStatus.VERIFIED,
        )

        # ── Cache the result ──
        cache_result(canonical, result.model_dump())

        # ── Persist to DB (async, non-blocking) ──
        await save_claim_result(result.model_dump())

        elapsed = time.time() - start_time
        logger.info(
            "━━━ Done: %s | confidence=%.3f | %.1fs ━━━",
            result.verdict.value,
            result.confidence,
            elapsed,
        )

        return result

    except Exception as e:
        elapsed = time.time() - start_time
        logger.error("Pipeline failed after %.1fs: %s", elapsed, e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Fact-check pipeline error: {str(e)}",
        )


# ──────────────────────────────────────────────────────────────────────
# Session history endpoint (for P1 to retrieve all verdicts for a session)
# ──────────────────────────────────────────────────────────────────────

@app.get("/session/{session_id}/claims")
async def get_session_claims(session_id: str):
    """Retrieve all fact-check results for a given session."""
    from app.database.repositories import get_claims_by_session
    claims = await get_claims_by_session(session_id)
    return {"session_id": session_id, "claims": claims, "count": len(claims)}
