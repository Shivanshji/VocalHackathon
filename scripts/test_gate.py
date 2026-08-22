#!/usr/bin/env python3
import argparse, asyncio, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ai.speech.factcheck_gate import GeminiGate
from backend.config import get_settings

async def main():
    parser = argparse.ArgumentParser(); parser.add_argument("text"); args = parser.parse_args()
    print((await GeminiGate(get_settings()).classify_fact_check_worthiness(args.text)).model_dump_json(indent=2))

if __name__ == "__main__": asyncio.run(main())
