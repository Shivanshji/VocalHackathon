"""
P2 → P3 input schema.

This is the exact JSON contract that Person 2's Audio Pipeline emits.
Do NOT modify these fields without coordinating with P2.
"""

from pydantic import BaseModel, Field


class ClaimInput(BaseModel):
    """Routed claim from P2's audio pipeline."""

    session_id: str = Field(..., description="Session identifier (set by P2)")
    segment_id: str = Field(..., description="Segment identifier (e.g. 'seg_28')")
    start: float = Field(..., description="Segment start time in seconds")
    end: float = Field(..., description="Segment end time in seconds")
    english_text: str = Field(
        ...,
        description="Translated English text of the spoken segment",
    )
    should_fact_check: bool = Field(
        ...,
        description="Whether P2's router flagged this for fact-checking",
    )
    statement_type: str = Field(
        ...,
        description="Type classification (e.g. 'factual_claim', 'opinion', 'question')",
    )
    routing_reason: str = Field(
        ...,
        description="P2's explanation for why this was routed for fact-checking",
    )
