import asyncio
import re
from backend.config import Settings
from backend.models import FactCheckGateResult, StatementType

INSTRUCTION = """You are a routing classifier for a media fact-checking system. Your ONLY task is
to decide whether the statement contains a meaningful externally verifiable factual assertion.
Return true for specific real-world claims verifiable against trustworthy external evidence.
Return false for pure opinions, greetings, requests, instructions, rhetoric, filler, or preferences.
If opinion and a factual claim coexist, return true. Never fact-check, judge truth, search, provide
evidence, sources, corrections, or external knowledge. Return only the structured classification."""


class GeminiGate:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._client = None

    def _get_client(self):
        if not self.settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        if self._client is None:
            from google import genai
            self._client = genai.Client(api_key=self.settings.gemini_api_key)
        return self._client

    async def classify_fact_check_worthiness(self, english_text: str) -> FactCheckGateResult:
        deterministic = self._deterministic_claim(english_text)
        if deterministic is not None:
            return deterministic
        response = await asyncio.wait_for(self._get_client().aio.models.generate_content(
            model=self.settings.gemini_model,
            contents=f"Classify this statement:\n{english_text}",
            config={"system_instruction": INSTRUCTION, "temperature": 0,
                    "response_mime_type": "application/json", "response_schema": FactCheckGateResult}),
            timeout=self.settings.ai_timeout_seconds)
        parsed = getattr(response, "parsed", None)
        return FactCheckGateResult.model_validate(parsed) if parsed is not None else FactCheckGateResult.model_validate_json(response.text)

    @staticmethod
    def _deterministic_claim(text: str) -> FactCheckGateResult | None:
        """Route obvious verifiable claims even when the LLM quota is unavailable."""
        normalized = " ".join(text.lower().split())
        patterns = (
            r"\b(?:i|we|he|she|they|[a-z][a-z .'-]+)\s+(?:wrote|authored|created|invented|founded|discovered|developed|built)\b",
            r"\b(?:president|prime minister|minister|governor|chief minister|ceo|founder|author|inventor)\b",
            r"\b\d+(?:\.\d+)?\s*(?:%|percent|million|billion|crore|lakh|years?|people|dollars?|rupees?)\b",
            r"\b(?:increased|decreased|rose|fell|grew|declined)\s+by\b",
        )
        if any(re.search(pattern, normalized) for pattern in patterns):
            return FactCheckGateResult(
                should_fact_check=True,
                statement_type=StatementType.factual_claim,
                reason="Matched a deterministic externally verifiable claim pattern.",
            )
        return None
