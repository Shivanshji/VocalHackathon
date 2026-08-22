#!/usr/bin/env python3
import argparse, asyncio, tempfile, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ai.speech.factcheck_gate import GeminiGate
from ai.speech.stt import WhisperTranscriber
from ai.speech.translator import IndicTransTranslator
from backend.config import get_settings
from backend.services.pipeline import AudioPipeline

async def main():
    parser = argparse.ArgumentParser(); parser.add_argument("audio", type=Path); args = parser.parse_args()
    settings = get_settings(); pipeline = AudioPipeline(WhisperTranscriber(settings), IndicTransTranslator(settings), GeminiGate(settings))
    with tempfile.TemporaryDirectory(prefix="pipeline-test-") as directory:
        result = await pipeline.process_audio(str(args.audio), str(Path(directory) / "normalized.wav"))
    gate = result.fact_check_gate
    print(f"Detected language:\n{result.detected_language}\n\nOriginal:\n{result.original_text}\n\nEnglish:\n{result.english_text or 'Unavailable'}")
    print(f"\nShould fact check:\n{gate.should_fact_check}\n\nStatement type:\n{gate.statement_type}\n\nReason:\n{gate.reason}")
    print(f"\nSTT latency: {result.stt_latency_ms:.0f} ms\nTranslation latency: {result.translation_latency_ms or 0:.0f} ms\nGemini latency: {result.classification_latency_ms or 0:.0f} ms\nTotal latency: {result.total_latency_ms:.0f} ms")

if __name__ == "__main__": asyncio.run(main())
