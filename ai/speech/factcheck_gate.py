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

    async def classify_fact_check_worthiness(self, english_text: str, context: str = "") -> FactCheckGateResult:
        deterministic = self._deterministic_claim(english_text)
        if deterministic is not None:
            return deterministic
        response = await asyncio.wait_for(self._get_client().aio.models.generate_content(
            model=self.settings.gemini_model,
            contents=f"Context (only for resolving references):\n{context or 'None'}\n\nClassify this statement:\n{english_text}",
            config={"system_instruction": INSTRUCTION, "temperature": 0,
                    "response_mime_type": "application/json", "response_schema": FactCheckGateResult}),
            timeout=self.settings.ai_timeout_seconds)
        parsed = getattr(response, "parsed", None)
        return FactCheckGateResult.model_validate(parsed) if parsed is not None else FactCheckGateResult.model_validate_json(response.text)

    @staticmethod
    def _deterministic_claim(text: str) -> FactCheckGateResult | None:
        """Route substantive assertions with high recall.

        Person 2 is a router, not the fact checker. Person 3 owns the final
        verifiability decision and verdict, so dropping an unfamiliar factual
        relation here is worse than forwarding an occasional false positive.
        """
        normalized = " ".join(text.lower().split())
        if not normalized:
            return FactCheckGateResult(should_fact_check=False, statement_type=StatementType.other,
                                       reason="Empty statement.")

        # Linguistic exclusions only; no topic or entity allow-list.
        non_claim_patterns = (
            r"^(?:hi|hello|hey|good (?:morning|afternoon|evening)|thank you|thanks|bye)[.!]*$",
            r"^(?:please\s+)?(?:tell|show|give|send|open|close|play|stop|go|come|look|listen|wait)\b",
            r"^(?:i|we)\s+(?:like|love|hate|prefer|feel|hope|wish|want|need)\b",
            r"^(?:in my opinion|i think|i believe|personally)\b",
        )
        if normalized.endswith("?") or any(re.search(pattern, normalized) for pattern in non_claim_patterns):
            return FactCheckGateResult(
                should_fact_check=False, statement_type=StatementType.other,
                reason="Question, social phrase, instruction, or personal preference.")

        if len(re.findall(r"\b[\w'-]+\b", normalized)) >= 3:
            return FactCheckGateResult(
                should_fact_check=True, statement_type=StatementType.factual_claim,
                reason="Substantive declarative assertion routed for downstream verification.")
        return None
