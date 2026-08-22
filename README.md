# SachMein? — Multilingual Truth Engine

## Team

- **Kevin Vinu** — 12313393
- **Shivansh Dubey** — 12304505
- **Sweeety Biju** — 12300581

SachMein? turns multilingual spoken media into synchronized English translations and evidence-backed fact checks. Users can upload audio or video in English, Hindi, Malayalam, Tamil, or Telugu, begin playback once an initial processing buffer is ready, and follow the current spoken line while factual claims are independently verified against web evidence.

## Team Contributions

### Person 1 — Product Experience and Frontend

- Designed and implemented the responsive SachMein? product interface, upload experience, media controls, navigation, visual system, and presentation-ready landing page.
- Built synchronized playback views that reveal the current transcription and English translation according to source-media timestamps while keeping future content hidden.
- Created a dedicated live fact-check panel with verdict states, confidence, explanations, evidence links, buffering feedback, error handling, and bounded result history.
- Connected the frontend to the streaming backend, handled incremental NDJSON events, protected playback from outrunning processed audio, and integrated all three modules into one demonstrable experience.

### Person 2 — Multilingual Speech Intelligence

- Built the media-processing pipeline for audio extraction, FFmpeg normalization, five-second chunking, timestamp preservation, language detection, and Faster Whisper transcription.
- Integrated AI4Bharat IndicTrans2 for English translation across supported Indic languages, including model reuse, language locking, fallback transcription, and graceful chunk-level recovery.
- Developed atomic statement segmentation, short-term speaker context, first-person reference resolution, and a high-recall factual-assertion router that avoids topic-specific hardcoding.
- Implemented independent asynchronous transcription, translation, routing, and verification queues so slow downstream checks do not block subtitles, progress updates, or continued media processing.

### Person 3 — Evidence Retrieval and Fact Verification

- Built the claim-verification service that receives structured, timestamped English claims and normalizes them into clear, independently searchable statements.
- Implemented claim decomposition and dual-sided query generation to search for both supporting and contradicting evidence instead of searching only for confirmation.
- Integrated Tavily retrieval, source-quality ranking, evidence extraction, semantic relevance scoring, caching hooks, and optional database persistence for traceable results.
- Produced structured verdicts—supported, contradicted, misleading, or insufficient evidence—with calculated confidence, concise explanations, and clickable sources for frontend presentation.

## End-to-End Architecture

```text
Audio or video upload
        ↓
FFmpeg extraction, normalization and 5-second chunking
        ↓
Faster Whisper transcription and language detection
        ↓
IndicTrans2 English translation
        ↓
Atomic statement splitting and contextual claim routing
        ↓
Tavily web retrieval, evidence ranking and Gemini verification
        ↓
Timestamp-synchronized translation and fact-check cards
```

The pipeline uses independent producer-consumer queues. Translation can reach the interface while later chunks are still being transcribed, and fact-checking can continue without freezing transcription or playback preparation. Person 2 prioritizes recall when routing declarative assertions; Person 3 owns the final decision about verifiability and truth.

## Core Features

- Upload MP3, MP4, WAV, M4A, WebM, or MOV files up to 50 MB.
- Extract and normalize embedded audio to mono 16 kHz PCM using FFmpeg.
- Transcribe and translate English, Hindi, Malayalam, Tamil, and Telugu speech.
- Stream chunk, segment, claim, and verdict progress using newline-delimited JSON.
- Resolve nearby first-person references with bounded session-local context.
- Keep transcription and translation synchronized with the media timeline.
- Retrieve supporting and contradicting evidence from the web.
- Display verdicts, confidence, explanations, and source links separately from subtitles.
- Continue useful upstream work when an individual chunk, translation, router, or fact-check request fails.

## Requirements

- Python 3.11 or 3.12
- Node.js 20+
- FFmpeg
- A Hugging Face account approved for [IndicTrans2](https://huggingface.co/ai4bharat/indictrans2-indic-en-dist-200M)
- Gemini and Tavily API credentials for the fact-checking service
- Internet access and sufficient disk space for the first model downloads

On macOS, install FFmpeg with:

```bash
brew install ffmpeg
```

## Installation

Create the shared Python environment:

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install -r fact-checker/requirements.txt
cp .env.example .env
```

Accept the IndicTrans2 access terms and authenticate locally:

```bash
hf auth login
```

Install the frontend dependencies:

```bash
cd frontend
npm install
cd ..
```

Keep all real credentials in local `.env` files. Never commit API keys or place server credentials in frontend environment variables.

## Running Locally

Start the Person 2 speech service from the repository root:

```bash
source .venv/bin/activate
uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Start the Person 3 fact-checking service in a second terminal:

```bash
source .venv/bin/activate
cd fact-checker
uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Start the frontend in a third terminal:

```bash
cd frontend
npm run dev -- --host 127.0.0.1
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Health checks are available at `http://127.0.0.1:8000/health` and `http://127.0.0.1:8001/health`.

## Testing

Run the automated backend and contract tests:

```bash
source .venv/bin/activate
pytest -q
```

Validate the frontend:

```bash
cd frontend
npm run lint
npm run build
```

Independent stage scripts are also provided:

```bash
python scripts/test_stt.py samples/english.wav
python scripts/test_translation.py ml "ഇന്ത്യയുടെ unemployment rate രണ്ട് percent ആയി കുറഞ്ഞു"
python scripts/test_gate.py "LPU is in Uganda."
python scripts/test_pipeline.py samples/malayalam.wav
```

The test suite covers API validation, schemas, timestamp segmentation, contextual memory, unseen factual assertions, non-claim filtering, Person 2–Person 3 contract compatibility, and local CORS behavior.

## Service Contract

Person 2 sends Person 3 a self-contained claim with session and timeline metadata:

```json
{
  "session_id": "audio_session_id",
  "segment_id": "seg_3_claim_1",
  "start": 10.2,
  "end": 14.7,
  "english_text": "LPU is in Uganda.",
  "should_fact_check": true,
  "statement_type": "factual_claim",
  "routing_reason": "Substantive declarative assertion routed for downstream verification."
}
```

Person 3 returns a verdict, evidence-derived confidence, explanation, and ranked sources. These results are streamed back to the frontend independently of transcription and translation events.

## Known Limitations

- The current upload endpoint receives the complete file before server-side chunk processing begins; true microphone streaming is a future extension.
- Transcription quality depends on recording clarity, background music, accent, code-mixing, and the selected Whisper model.
- IndicTrans2 can produce imperfect translations for heavily mixed-language or fragmented speech.
- Free-tier Gemini and Tavily quotas can delay or temporarily prevent fact-check completion.
- Redis and PostgreSQL are optional locally; live verification works without them, but caching and historical persistence are disabled.
- A verdict reflects the evidence retrieved at that time and should expose its sources rather than be treated as unquestionable truth.
