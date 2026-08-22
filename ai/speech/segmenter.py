import re

from backend.models import TranscriptSegment

SENTENCE_END = re.compile(r"[.!?।॥؟。！？][\"'’”)]*$")


def sentence_segments(
    whisper_segments: list[TranscriptSegment],
    *,
    pause_seconds: float = 1.0,
    max_duration_seconds: float = 15.0,
    max_characters: int = 260,
) -> list[TranscriptSegment]:
    """Group acoustic chunks into bounded, timestamped sentence-like units."""
    output: list[TranscriptSegment] = []
    current: list[TranscriptSegment] = []

    def flush() -> None:
        if not current:
            return
        output.append(TranscriptSegment(
            start=current[0].start,
            end=current[-1].end,
            text=" ".join(item.text.strip() for item in current).strip(),
        ))
        current.clear()

    for item in whisper_segments:
        if current and item.start - current[-1].end >= pause_seconds:
            flush()
        current.append(item)
        text = " ".join(part.text for part in current)
        duration = current[-1].end - current[0].start
        if SENTENCE_END.search(item.text.strip()) or duration >= max_duration_seconds or len(text) >= max_characters:
            flush()
    flush()
    return output
