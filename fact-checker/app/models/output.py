"""
P3 → P1 output schema.

This is the exact JSON contract that Person 1's Chrome Extension consumes.
`session_id`, `segment_id`, `start`, `end` are preserved end-to-end so P1
can anchor notes to the video timeline.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class Verdict(str, Enum):
    """Possible fact-check verdicts."""
    SUPPORTED = "SUPPORTED"
    CONTRADICTED = "CONTRADICTED"
    MISLEADING = "MISLEADING"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"


class EvidenceItem(BaseModel):
    """A single piece of retrieved evidence."""
    title: str = Field(..., description="Title of the source page")
    url: str = Field(..., description="URL of the source")
    source_quality: float = Field(
        ..., ge=0.0, le=1.0,
        description="Authority/quality score for this source (0-1)",
    )
    stance: str = Field(
        ...,
        description="Relationship to the claim: 'supports', 'contradicts', or 'neutral'",
    )
    text: str = Field(..., description="Relevant excerpt from the source")
    relevance_score: float = Field(
        default=0.0, ge=0.0, le=1.0,
        description="Semantic similarity between this evidence and the claim (0-1)",
    )


class VerificationStatus(str, Enum):
    """Processing status of a fact-check request."""
    VERIFIED = "verified"
    ERROR = "error"
    CACHED = "cached"


class FactCheckResult(BaseModel):
    """Complete fact-check result sent to P1."""

    session_id: str = Field(..., description="Preserved from input")
    segment_id: str = Field(..., description="Preserved from input")
    start: float = Field(..., description="Preserved from input — segment start time")
    end: float = Field(..., description="Preserved from input — segment end time")
    original_text: str = Field(..., description="Original English text from P2")
    canonical_claim: str = Field(
        ...,
        description="Normalized, canonical form of the claim",
    )
    sub_claims: Optional[List[str]] = Field(
        default=None,
        description="Atomic sub-claims if the original was compound",
    )
    verdict: Verdict = Field(..., description="Final fact-check verdict")
    confidence: float = Field(
        ..., ge=0.0, le=1.0,
        description="Calculated confidence score (NOT LLM-guessed)",
    )
    explanation: str = Field(..., description="Human-readable explanation of the verdict")
    evidence: List[EvidenceItem] = Field(
        default_factory=list,
        description="Retrieved evidence items with quality and stance",
    )
    checked_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO timestamp of when the check was performed",
    )
    status: VerificationStatus = Field(
        default=VerificationStatus.VERIFIED,
        description="Processing status",
    )
