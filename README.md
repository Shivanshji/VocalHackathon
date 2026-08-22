# Person 2 Speech Pipeline

Person 2 answers three questions: what was said (faster-whisper), what it means in English (AI4Bharat IndicTrans2), and whether it contains a claim worth verifying (Gemini). It does **not** determine truth, search for evidence, or implement Person 1/Person 3 systems.

## Requirements

- Python 3.11 or 3.12 (recommended for ML dependencies)
- Node.js 20+
- FFmpeg (`brew install ffmpeg` on macOS)
- Gemini API key
- A Hugging Face account approved for the gated [IndicTrans2 model](https://huggingface.co/ai4bharat/indictrans2-indic-en-dist-200M)
- Internet/disk space for the first Whisper and IndicTrans2 model downloads

## Backend

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Put `GEMINI_API_KEY` in the root `.env`. The default model configuration is CPU-safe and editable there. Never place the Gemini key in the frontend environment.

Before the first Indic translation, accept the model's access terms and authenticate locally:

```bash
hf auth login
```

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
curl http://localhost:8000/health
```

Whisper and IndicTrans2 are lazy-loaded once on first use, then reused by all requests. This keeps `/health` usable before multi-GB model downloads complete.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Person 1's upload UI now calls the Person 2 API directly. The standalone Person 2 diagnostic page remains available at `/person2-test`.

## API

`POST /api/analyze-audio` accepts multipart field `audio` in `.wav`, `.mp3`, `.m4a`, `.webm`, `.mp4`, or `.mov` format. For video containers, FFmpeg extracts the audio track. It returns dominant language/probability, original timestamped segments, English translation, routing metadata, and stage timings. Uploads are limited to 50 MB, normalized to mono 16 kHz WAV in request-unique temporary directories, and always cleaned.

The API also returns `processed_segments`: bounded sentence-like units with IDs, timestamps, original/English text, and an independent Gemini routing decision. The frontend uses these timestamps for click-to-seek and active-sentence highlighting during local audio/video playback.

VAD defaults off so music beds and long-form media are not silently discarded. Set `WHISPER_VAD_FILTER=true` for clean speech recordings if skipping long silences is preferred.

If translation fails, the original transcript remains in the response. If Gemini fails, routing becomes `should_fact_check: null`, type `unknown`, reason `Classification unavailable.` No successful upstream work is discarded.

## Independent stage tests

Add audio under `samples/` and run:

```bash
python scripts/test_stt.py samples/english.wav
python scripts/test_translation.py ml "ഇന്ത്യയുടെ unemployment rate രണ്ട് percent ആയി കുറഞ്ഞു"
python scripts/test_gate.py "India's GDP grew by 20% last year."
python scripts/test_pipeline.py samples/malayalam.wav
```

Automated checks:

```bash
pip install -r requirements-dev.txt
pytest
cd frontend && npm run lint && npm run build
```

## Known limitations

IndicTrans2 is strongest on supported Indic scripts and can be imperfect on heavily code-mixed text. Embedded English is passed through the dedicated model and logged; Gemini is deliberately not used as a translation fallback. English transcripts bypass translation. Unsupported detected languages return the transcript with translation unavailable.

## Future contracts

The thin upload route passes a file path into the reusable `AudioPipeline`, so Person 1's future 3–5 second WebM/Opus chunks can use the same normalization/STT/translation/routing stages. Timestamped segments are retained. In live mode, translated subtitles should branch immediately to Person 1 while Gemini routing proceeds separately.

Every meaningful finalized segment—both `should_fact_check=true` and `false`—should later go to Person 3 with English text, timestamps, statement type, and routing reason. Person 3 alone decides whether to run evidence retrieval and whether a claim is true.
