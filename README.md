# SachMein? — Multilingual Truth Engine

> **Hackathon Lane: AI for Bharat**
>
> Regional speech → live English understanding → evidence-backed truth checks

## Team

- **Kevin Vinu** — 12313393
- **Shivansh Dubey** — 12304505
- **Sweeety Biju** — 12300581

SachMein? is a multimodal truth layer for people who receive important information through regional-language audio and video rather than clean English text. A user can upload spoken media in English, Hindi, Malayalam, Tamil, or Telugu, begin playback once an initial processing buffer is ready, follow a synchronized English translation, and see factual claims checked against web evidence as they are spoken.

This is an **AI for Bharat** project because its core problem is access: code-mixed regional speech is difficult to search, translate, and verify quickly. It is also genuinely **multimodal**—audio or video, timestamped speech, translated text, and retrieved web evidence cooperate in one continuous experience.

## The Problem

Students, journalists, community moderators, and everyday viewers regularly encounter claims inside regional-language speeches, interviews, forwarded clips, and news videos. Verifying those claims currently requires understanding the source language, manually transcribing the statement, translating it, extracting the factual assertion, searching the web, and judging conflicting sources. By the time that process finishes, the media has already moved on.

SachMein? compresses that workflow into one interface. It preserves what was said, produces an English representation, separates checkable assertions from surrounding speech, retrieves evidence on both sides, and shows an uncertainty-aware verdict linked to the original moment in the media.

## Why This Could Not Realistically Exist in 2023

The product depends on several recently practical capabilities working together: robust multilingual speech recognition, high-quality Indic translation, structured LLM reasoning, fast web retrieval, semantic evidence ranking, and streamed model outputs. Removing the AI collapses the product—the system could still play a video, but it could not understand regional speech, translate it, resolve fragmented claims, retrieve relevant evidence, or explain whether the evidence supports the statement.

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

### Model and Modality Cooperation

| Layer | Technology | What it contributes |
| --- | --- | --- |
| Media understanding | FFmpeg + Faster Whisper | Extracts audio from audio/video, detects language, transcribes speech, and preserves timestamps. |
| Bharat-language understanding | AI4Bharat IndicTrans2 | Converts supported Indic-language speech transcripts into English while retaining the original line. |
| Claim intelligence | Context memory + structured Gemini calls | Resolves nearby speaker references, normalizes claims, decomposes compound assertions, and plans balanced searches. |
| Retrieval | Tavily + source ranking | Finds supporting and contradicting material, removes duplicates, and prioritizes stronger sources. |
| Evidence reasoning | Semantic relevance + Gemini verification | Measures evidence relevance and returns a sourced verdict with an independently calculated confidence signal. |
| Live experience | React + FastAPI + NDJSON queues | Streams translations, claims, progress, errors, and verdicts without making every stage wait for the slowest one. |

No model is called twice merely to satisfy a constraint. Whisper, IndicTrans2, semantic embeddings, and Gemini perform distinct jobs, and the output of each stage becomes structured input to the next.

## What We Built Beyond the APIs

- A hand-built asynchronous orchestration layer with separate transcription, translation, routing, and fact-check queues.
- Five-second media segmentation, global timestamp reconstruction, initial playback buffering, and timeline-synchronized result disclosure.
- Atomic claim splitting and bounded session memory that turn fragmented first-person speech into self-contained searchable assertions.
- A high-recall router that forwards unfamiliar declarative claims instead of relying on a hardcoded list of people, roles, or subjects.
- Dual-sided retrieval that deliberately searches for contradiction as well as support, followed by source ranking and evidence extraction.
- Contract validation between independently developed modules, structured streaming events, timeout handling, fallbacks, and visible failure states.
- An automated regression suite for APIs, schemas, segmentation, contextual memory, claim routing, integration contracts, and browser CORS behavior.

Gemini assists with reasoning inside the pipeline; it is not the product. The surrounding media processing, local models, context handling, retrieval, ranking, confidence calculation, orchestration, synchronization, evaluation, and user experience are the system.

## Hackathon Constraint Alignment

### Multiple models and modalities

The implementation combines Faster Whisper, IndicTrans2, semantic sentence embeddings, Gemini, audio/video input, translated text, and web evidence. Each component performs a separate necessary operation.

### Graceful degradation

If one audio chunk fails, later chunks continue. If strict speech filtering finds nothing, transcription retries with relaxed filters. A translation failure does not erase the original transcript. If the optional routing classifier is unavailable, substantive statements are forwarded rather than silently discarded. Fact-check failures appear as `CHECK UNAVAILABLE` without freezing translation or playback.

### Handling uncertainty and being wrong

The interface distinguishes `SUPPORTED`, `CONTRADICTED`, `MISLEADING`, and `INSUFFICIENT_EVIDENCE`. It shows evidence-derived confidence, explanations, and source links instead of presenting an unsupported binary answer. Person 3 can refuse a verdict when a statement is ambiguous or the retrieved evidence is inadequate.

### Evaluation and observability

The repository includes automated regression and contract tests plus independent scripts for transcription, translation, routing, and the full pipeline. Runtime logs expose stage progress, latency, model failures, search result counts, evidence extraction, and final confidence. This makes failures inspectable instead of hiding them behind a generic AI response.

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

## Five Questions We Expect Judges to Ask

### 1. Who has this problem?

A regional-language media viewer—especially a student, journalist, community moderator, or citizen—who needs to understand and verify a spoken claim without manually translating and searching for it.

### 2. What was the non-obvious hard part?

The difficult part was not calling a model. It was keeping long-running transcription, translation, claim routing, web retrieval, and playback synchronized without allowing a slow or failed stage to freeze the entire experience.

### 3. What did the APIs provide, and what did we build?

The models provide transcription, translation, reasoning, and search primitives. We built the media pipeline, timestamps, chunk orchestration, contextual memory, atomic claims, high-recall routing, dual-sided evidence flow, ranking, confidence logic, streaming contract, synchronized interface, fallbacks, and tests.

### 4. Why does it break if AI is removed?

Without the models, SachMein? becomes only a media player. It loses multilingual listening, English translation, contextual claim extraction, semantic retrieval, evidence interpretation, and verdict generation—the entire user value.

### 5. What breaks at ten thousand users?

The current prototype would first encounter GPU/CPU inference capacity, Gemini and Tavily quotas, concurrent job pressure, and missing production persistence. A production version would require queued workers, autoscaled inference, request deduplication, durable object storage, Redis caching, PostgreSQL, per-user limits, and explicit cost monitoring.

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
