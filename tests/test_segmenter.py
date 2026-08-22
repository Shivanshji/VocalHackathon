from ai.speech.segmenter import sentence_segments
from backend.models import TranscriptSegment


def test_groups_chunks_until_sentence_punctuation():
    result = sentence_segments([
        TranscriptSegment(start=0, end=1, text="India's unemployment"),
        TranscriptSegment(start=1, end=2, text="rate is two percent."),
        TranscriptSegment(start=2.1, end=3, text="I dislike that policy."),
    ])
    assert [(item.start, item.end, item.text) for item in result] == [
        (0, 2, "India's unemployment rate is two percent."),
        (2.1, 3, "I dislike that policy."),
    ]


def test_long_pause_closes_unpunctuated_sentence():
    result = sentence_segments([
        TranscriptSegment(start=0, end=1, text="First thought"),
        TranscriptSegment(start=2.5, end=3, text="Second thought"),
    ])
    assert len(result) == 2
