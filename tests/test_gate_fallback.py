from ai.speech.factcheck_gate import GeminiGate


def test_authorship_claim_routes_without_gemini():
    result = GeminiGate._deterministic_claim("My name is Sweety Biju. I wrote the Constitution of India.")
    assert result is not None
    assert result.should_fact_check is True
    assert result.statement_type == "factual_claim"


def test_plain_introduction_is_routed_for_downstream_verifiability_check():
    result = GeminiGate._deterministic_claim("My name is Sweety Biju.")
    assert result is not None and result.should_fact_check is True


def test_present_perfect_authorship_routes_without_gemini():
    result = GeminiGate._deterministic_claim("Sweety Biju has written the Constitution of India.")
    assert result is not None and result.should_fact_check is True


def test_unseen_location_claim_routes_without_topic_hardcoding():
    result = GeminiGate._deterministic_claim("LPU is in Uganda.")
    assert result is not None and result.should_fact_check is True


def test_varied_unseen_declarative_claims_are_routed():
    examples = (
        "The moon is made of cheese.",
        "Tokyo has fewer residents than Delhi.",
        "Water boils at 40 degrees Celsius.",
        "Ada Lovelace designed the first smartphone.",
        "Kerala borders the Pacific Ocean.",
    )
    for text in examples:
        result = GeminiGate._deterministic_claim(text)
        assert result is not None and result.should_fact_check is True, text


def test_obvious_non_claims_are_filtered_locally():
    examples = ("Hello!", "What is the capital of India?", "I love this song.", "Please play the video.")
    for text in examples:
        result = GeminiGate._deterministic_claim(text)
        assert result is not None and result.should_fact_check is False, text
