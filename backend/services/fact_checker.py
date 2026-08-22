import httpx

from backend.models import ClaimInput, FactCheckResult


class FactCheckerClient:
    def __init__(self, base_url: str, timeout_seconds: float = 90):
        self.url = f"{base_url.rstrip('/')}/fact-check"
        self.timeout_seconds = timeout_seconds

    async def check(self, claim: ClaimInput) -> FactCheckResult:
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(self.url, json=claim.model_dump(mode="json"))
            response.raise_for_status()
            return FactCheckResult.model_validate(response.json())
