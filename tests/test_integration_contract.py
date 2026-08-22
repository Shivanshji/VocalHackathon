from backend.models import ClaimInput, FactCheckResult


def test_person2_claim_matches_person3_contract():
    claim = ClaimInput(session_id="session_1", segment_id="seg_2", start=5, end=10,
                       english_text="India has a population of 1.4 billion.",
                       should_fact_check=True, statement_type="factual_claim",
                       routing_reason="Externally verifiable numerical assertion.")
    assert set(claim.model_dump()) == {"session_id", "segment_id", "start", "end", "english_text",
                                       "should_fact_check", "statement_type", "routing_reason"}


def test_person3_result_contract_is_accepted():
    result = FactCheckResult(session_id="session_1", segment_id="seg_2", start=5, end=10,
                             original_text="A claim", canonical_claim="A claim.", verdict="SUPPORTED",
                             confidence=0.8, explanation="Supported by evidence.", evidence=[],
                             checked_at="2026-08-22T00:00:00Z", status="verified")
    assert result.segment_id == "seg_2"
