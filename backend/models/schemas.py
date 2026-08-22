from enum import StrEnum
from pydantic import BaseModel, Field, model_validator


class StatementType(StrEnum):
    factual_claim = "factual_claim"
    opinion = "opinion"
    prediction = "prediction"
    rhetorical = "rhetorical"
    instruction = "instruction"
    greeting = "greeting"
    mixed = "mixed"
    other = "other"
    unknown = "unknown"


class TranscriptSegment(BaseModel):
    start: float = Field(ge=0)
    end: float = Field(ge=0)
    text: str

    @model_validator(mode="after")
    def end_is_after_start(self):
        if self.end < self.start:
            raise ValueError("end must not precede start")
        return self


class STTResult(BaseModel):
    detected_language: str | None
    language_probability: float | None
    segments: list[TranscriptSegment]
    full_text: str


class FactCheckGateResult(BaseModel):
    should_fact_check: bool | None
    statement_type: StatementType
    reason: str = Field(min_length=1, max_length=240)


class ProcessedSegment(BaseModel):
    segment_id: str
    start: float = Field(ge=0)
    end: float = Field(ge=0)
    original_text: str
    english_text: str | None
    fact_check_gate: FactCheckGateResult


class ClaimInput(BaseModel):
    session_id: str
    segment_id: str
    start: float
    end: float
    english_text: str
    should_fact_check: bool
    statement_type: str
    routing_reason: str


class EvidenceItem(BaseModel):
    title: str
    url: str
    source_quality: float
    stance: str
    text: str
    relevance_score: float = 0.0


class FactCheckResult(BaseModel):
    session_id: str
    segment_id: str
    start: float
    end: float
    original_text: str
    canonical_claim: str
    sub_claims: list[str] | None = None
    verdict: str
    confidence: float
    explanation: str
    evidence: list[EvidenceItem] = Field(default_factory=list)
    checked_at: str
    status: str


class AudioAnalysisResponse(BaseModel):
    detected_language: str | None
    language_probability: float | None
    original_text: str
    english_text: str | None
    segments: list[TranscriptSegment]
    processed_segments: list[ProcessedSegment]
    fact_check_gate: FactCheckGateResult
    stt_latency_ms: float
    translation_latency_ms: float | None
    classification_latency_ms: float | None
    total_latency_ms: float
