from ai.speech.factcheck_gate import GeminiGate


def test_authorship_claim_routes_without_gemini():
    result = GeminiGate._deterministic_claim("My name is Sweety Biju. I wrote the Constitution of India.")
    assert result is not None
    assert result.should_fact_check is True
    assert result.statement_type == "factual_claim"


def test_plain_introduction_is_not_forced_to_fact_checker():
    assert GeminiGate._deterministic_claim("My name is Sweety Biju.") is None
