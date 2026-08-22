#!/usr/bin/env python3
import argparse, asyncio, tempfile, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ai.speech.stt import WhisperTranscriber
from backend.config import get_settings
from backend.services.audio import normalize_audio

async def main():
    parser = argparse.ArgumentParser(); parser.add_argument("audio", type=Path); args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="stt-test-") as directory:
        normalized = str(Path(directory) / "normalized.wav")
        await normalize_audio(str(args.audio), normalized)
        result = await WhisperTranscriber(get_settings()).transcribe_audio(normalized)
    print(result.model_dump_json(indent=2))

if __name__ == "__main__": asyncio.run(main())
