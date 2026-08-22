#!/usr/bin/env python3
import argparse, asyncio, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ai.speech.translator import IndicTransTranslator
from backend.config import get_settings

async def main():
    parser = argparse.ArgumentParser(); parser.add_argument("language", choices=["en", "hi", "ml", "ta", "te"]); parser.add_argument("text"); args = parser.parse_args()
    print(await IndicTransTranslator(get_settings()).translate_to_english(args.text, args.language))

if __name__ == "__main__": asyncio.run(main())
