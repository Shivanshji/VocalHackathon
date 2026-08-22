import re
from collections import deque


def atomic_statements(text: str) -> list[str]:
    """Split translated speech into independently routable statements."""
    normalized = " ".join(text.split()).strip()
    if not normalized:
        return []
    parts = re.split(
        r"(?<=[.!?])\s+|[,;]\s+(?:and|but)\s+(?=(?:i|we|he|she|they|[A-Z]))",
        normalized,
        flags=re.IGNORECASE,
    )
    return [part.strip(" ,;") for part in parts if part.strip(" ,;")]


class RoutingMemory:
    """Small session-local memory used only to resolve nearby claim context."""
    def __init__(self, size: int = 3):
        self.recent: deque[str] = deque(maxlen=size)
        self.speaker_name: str | None = None

    def remember(self, text: str) -> None:
        match = re.search(r"\bmy name is\s+([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){0,3})",
                          text, flags=re.IGNORECASE)
        if match:
            name = re.split(r"\s+(?:and|but)\b", match.group(1), maxsplit=1, flags=re.IGNORECASE)[0]
            self.speaker_name = name.strip()
        self.recent.append(text)

    def contextualize(self, statement: str) -> str:
        if not self.speaker_name:
            return statement
        replacements = (
            (r"^I have written\b", f"{self.speaker_name} has written"),
            (r"^I wrote\b", f"{self.speaker_name} wrote"),
            (r"^I am the author\b", f"{self.speaker_name} is the author"),
            (r"^I created\b", f"{self.speaker_name} created"),
            (r"^I invented\b", f"{self.speaker_name} invented"),
        )
        for pattern, replacement in replacements:
            updated, count = re.subn(pattern, replacement, statement, count=1, flags=re.IGNORECASE)
            if count:
                return updated
        return statement

    def summary(self) -> str:
        speaker = f"Known speaker name: {self.speaker_name}. " if self.speaker_name else ""
        return speaker + "Recent translated speech: " + " | ".join(self.recent)
