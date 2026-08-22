import logging
import time
import asyncio
from pathlib import Path
from ai.speech.factcheck_gate import GeminiGate
from ai.speech.segmenter import sentence_segments
from ai.speech.stt import WhisperTranscriber
from ai.speech.translator import IndicTransTranslator
from backend.models import AudioAnalysisResponse, ClaimInput, FactCheckGateResult, ProcessedSegment, StatementType
from backend.services.audio import normalize_audio, split_audio
from backend.services.fact_checker import FactCheckerClient

logger = logging.getLogger(__name__)


class AudioPipeline:
    def __init__(self, transcriber: WhisperTranscriber, translator: IndicTransTranslator, gate: GeminiGate,
                 fact_checker: FactCheckerClient | None = None):
        self.transcriber, self.translator, self.gate = transcriber, translator, gate
        self.fact_checker = fact_checker

    async def process_audio(self, input_path: str, normalized_path: str) -> AudioAnalysisResponse:
        total_started = time.perf_counter()
        await normalize_audio(input_path, normalized_path)
        logger.info("[AUDIO] normalized=true")

        started = time.perf_counter()
        stt = await self.transcriber.transcribe_audio(normalized_path)
        stt_ms = (time.perf_counter() - started) * 1000
        logger.info("[STT] language=%s latency=%.0fms", stt.detected_language, stt_ms)

        units = sentence_segments(stt.segments)
        logger.info("[SEGMENTER] whisper_segments=%d sentences=%d", len(stt.segments), len(units))
        processed: list[ProcessedSegment] = []
        translation_ms = 0.0
        classification_ms = 0.0
        translation_available = True
        classification_available = True

        for index, unit in enumerate(units, start=1):
            english = None
            if translation_available:
                try:
                    started = time.perf_counter()
                    english = await self.translator.translate_to_english(unit.text, stt.detected_language)
                    translation_ms += (time.perf_counter() - started) * 1000
                except Exception:
                    translation_available = False
                    logger.exception("[TRANSLATION] unavailable; remaining segments preserved untranslated")

            gate = FactCheckGateResult(should_fact_check=None, statement_type=StatementType.unknown,
                                       reason="Classification unavailable.")
            if english and classification_available:
                try:
                    started = time.perf_counter()
                    gate = await self.gate.classify_fact_check_worthiness(english)
                    classification_ms += (time.perf_counter() - started) * 1000
                except Exception:
                    classification_available = False
                    logger.exception("[GATE] unavailable; remaining segments preserved unclassified")
            processed.append(ProcessedSegment(
                segment_id=f"seg_{index}", start=unit.start, end=unit.end,
                original_text=unit.text, english_text=english, fact_check_gate=gate,
            ))

        english_parts = [item.english_text for item in processed if item.english_text]
        english = " ".join(english_parts) if english_parts else None
        decisions = [item.fact_check_gate for item in processed if item.fact_check_gate.should_fact_check is not None]
        if not decisions:
            aggregate_gate = FactCheckGateResult(should_fact_check=None, statement_type=StatementType.unknown,
                                                 reason="Classification unavailable.")
        elif any(item.should_fact_check for item in decisions):
            aggregate_gate = FactCheckGateResult(should_fact_check=True, statement_type=StatementType.mixed,
                                                 reason="At least one segment contains a verifiable factual claim.")
        else:
            aggregate_gate = FactCheckGateResult(should_fact_check=False, statement_type=StatementType.other,
                                                 reason="No segment contains a meaningful verifiable factual claim.")
        logger.info("[TRANSLATION] provider=IndicTrans2 sentences=%d latency=%.0fms", len(english_parts), translation_ms)
        logger.info("[GATE] provider=Gemini classified=%d latency=%.0fms", len(decisions), classification_ms)

        total_ms = (time.perf_counter() - total_started) * 1000
        logger.info("[DONE] file=%s total=%.0fms", Path(input_path).name, total_ms)
        return AudioAnalysisResponse(
            detected_language=stt.detected_language, language_probability=stt.language_probability,
            original_text=stt.full_text, english_text=english, segments=stt.segments,
            processed_segments=processed, fact_check_gate=aggregate_gate, stt_latency_ms=stt_ms,
            translation_latency_ms=translation_ms if processed else None,
            classification_latency_ms=classification_ms if decisions else None, total_latency_ms=total_ms)

    async def stream_audio(self, input_path: str, chunk_directory: str, chunk_seconds: int = 5,
                           session_id: str = "session"):
        """Pipeline STT ahead of translation without letting either block event delivery."""
        chunks = await split_audio(input_path, chunk_directory, chunk_seconds)
        yield {"type": "started", "chunk_seconds": chunk_seconds, "chunk_count": len(chunks)}
        output: asyncio.Queue = asyncio.Queue()
        # These jobs contain only text, so an unbounded queue is cheap. A bounded
        # queue made slow translation stop Whisper exactly eight chunks later.
        translation_jobs: asyncio.Queue = asyncio.Queue()
        routing_jobs: asyncio.Queue = asyncio.Queue()
        fact_check_jobs: asyncio.Queue = asyncio.Queue()
        state = {"segments": 0, "language": None}
        locked_language = None

        async def transcribe_worker():
            nonlocal locked_language
            for chunk_index, chunk in enumerate(chunks):
                offset = chunk_index * chunk_seconds
                try:
                    stt = await self.transcriber.transcribe_audio(str(chunk), locked_language)
                    if (locked_language is None and stt.detected_language in {"en", "hi", "ml", "ta", "te"}
                            and (stt.language_probability or 0) >= 0.65):
                        locked_language = stt.detected_language
                        logger.info("[STREAM STT] locked_language=%s", locked_language)
                    state["language"] = state["language"] or stt.detected_language
                    units = sentence_segments(stt.segments)
                    await translation_jobs.put((chunk_index, offset, stt.detected_language,
                                                stt.language_probability, units))
                except Exception as exc:
                    logger.info("[STREAM STT] chunk=%d skipped=%s", chunk_index, exc)
                    await translation_jobs.put((chunk_index, offset, None, None, []))
                await output.put({"type": "transcription_progress", "transcribed_chunks": chunk_index + 1,
                                  "chunk_count": len(chunks)})
            await translation_jobs.put(None)

        async def translation_worker():
            while True:
                job = await translation_jobs.get()
                if job is None:
                    break
                chunk_index, offset, language, probability, units = job
                for unit in units:
                    state["segments"] += 1
                    english = None
                    try:
                        translation_started = time.perf_counter()
                        english = await self.translator.translate_to_english(unit.text, language)
                        logger.info("[STREAM TRANSLATION] chunk=%d latency=%.0fms", chunk_index,
                                    (time.perf_counter() - translation_started) * 1000)
                    except Exception as exc:
                        logger.warning("[STREAM TRANSLATION] chunk=%d unavailable=%s", chunk_index, exc)
                    gate = FactCheckGateResult(should_fact_check=None, statement_type=StatementType.unknown,
                                               reason="Routing pending.")
                    item = ProcessedSegment(segment_id=f"seg_{state['segments']}", start=offset + unit.start,
                                            end=offset + unit.end, original_text=unit.text,
                                            english_text=english, fact_check_gate=gate)
                    # Translation is its own live product surface. Emit every
                    # translated segment immediately; routing/fact checking may lag.
                    await output.put({"type": "segment", "detected_language": language,
                                      "language_probability": probability,
                                      "segment": item.model_dump(mode="json")})
                    if english:
                        await routing_jobs.put((item, language, probability))
                await output.put({"type": "progress", "completed_chunks": chunk_index + 1,
                                  "chunk_count": len(chunks)})
            await routing_jobs.put(None)

        async def routing_worker():
            while True:
                job = await routing_jobs.get()
                if job is None:
                    break
                item, language, probability = job
                try:
                    gate = await self.gate.classify_fact_check_worthiness(item.english_text)
                except Exception as exc:
                    logger.warning("[STREAM GATE] segment=%s unavailable=%s", item.segment_id, exc)
                    continue
                if not gate.should_fact_check:
                    continue
                item.fact_check_gate = gate
                claim = ClaimInput(session_id=session_id, segment_id=item.segment_id,
                                   start=item.start, end=item.end, english_text=item.english_text,
                                   should_fact_check=True, statement_type=gate.statement_type.value,
                                   routing_reason=gate.reason)
                await output.put({"type": "claim", "detected_language": language,
                                  "language_probability": probability,
                                  "segment": item.model_dump(mode="json"),
                                  "claim": claim.model_dump(mode="json")})
                await fact_check_jobs.put(claim)
            await fact_check_jobs.put(None)

        async def fact_check_worker():
            while True:
                claim = await fact_check_jobs.get()
                if claim is None:
                    break
                if self.fact_checker is None:
                    continue
                try:
                    result = await self.fact_checker.check(claim)
                    await output.put({"type": "fact_check", "result": result.model_dump(mode="json")})
                except Exception as exc:
                    logger.warning("[FACT CHECK] segment=%s unavailable=%s", claim.segment_id, exc)
                    await output.put({"type": "fact_check_error", "segment_id": claim.segment_id,
                                      "detail": str(exc)})
            await output.put({"type": "complete", "detected_language": state["language"],
                              "segment_count": state["segments"]})
            await output.put(None)

        workers = [asyncio.create_task(transcribe_worker()), asyncio.create_task(translation_worker()),
                   asyncio.create_task(routing_worker()), asyncio.create_task(fact_check_worker())]
        try:
            while True:
                event = await output.get()
                if event is None:
                    break
                yield event
        finally:
            for worker in workers:
                if not worker.done():
                    worker.cancel()
            await asyncio.gather(*workers, return_exceptions=True)
