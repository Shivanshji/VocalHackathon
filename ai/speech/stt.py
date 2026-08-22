import asyncio
import threading
from backend.config import Settings
from backend.models import STTResult, TranscriptSegment


class STTError(Exception):
    pass


class WhisperTranscriber:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._model = None
        self._lock = threading.Lock()

    def _get_model(self):
        if self._model is None:
            with self._lock:
                if self._model is None:
                    from faster_whisper import WhisperModel
                    self._model = WhisperModel(self.settings.whisper_model,
                                               device=self.settings.whisper_device,
                                               compute_type=self.settings.whisper_compute_type)
        return self._model

    def _run(self, audio_path: str, language: str | None = None) -> STTResult:
        try:
            model = self._get_model()
            raw_segments, info = model.transcribe(
                audio_path,
                language=language,
                beam_size=5,
                vad_filter=self.settings.whisper_vad_filter,
                vad_parameters={"min_silence_duration_ms": self.settings.whisper_vad_min_silence_ms},
                condition_on_previous_text=True,
            )
            segments = [TranscriptSegment(start=s.start, end=s.end, text=s.text.strip())
                        for s in raw_segments if s.text.strip()]
            # Language detection can succeed while Whisper's no-speech/log-probability
            # filters discard every decoded segment (common with music and quiet clips).
            if not segments:
                raw_segments, info = model.transcribe(
                    audio_path,
                    language=language,
                    beam_size=5,
                    vad_filter=False,
                    no_speech_threshold=None,
                    log_prob_threshold=None,
                    compression_ratio_threshold=None,
                    condition_on_previous_text=False,
                )
                segments = [TranscriptSegment(start=s.start, end=s.end, text=s.text.strip())
                            for s in raw_segments if s.text.strip()]
        except Exception as exc:
            raise STTError(f"Transcription failed: {exc}") from exc
        if not segments:
            raise STTError("No transcribable speech was found. The file decoded correctly, but this section may be silent, music-heavy, or too quiet.")
        return STTResult(detected_language=getattr(info, "language", None),
                         language_probability=getattr(info, "language_probability", None),
                         segments=segments,
                         full_text=" ".join(s.text for s in segments))

    async def transcribe_audio(self, audio_path: str, language: str | None = None) -> STTResult:
        return await asyncio.to_thread(self._run, audio_path, language)
