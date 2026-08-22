import logging
import json
import shutil
import tempfile
from pathlib import Path
import aiofiles
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from ai.speech.stt import STTError
from backend.models import AudioAnalysisResponse
from backend.services.audio import AudioError

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)
SUPPORTED = {".wav", ".mp3", ".m4a", ".webm", ".mp4", ".mov"}


async def _save_upload(request: Request, audio: UploadFile, directory: str, suffix: str) -> Path:
    source = Path(directory) / f"input{suffix}"
    max_bytes = request.app.state.settings.max_upload_mb * 1024 * 1024
    size = 0
    async with aiofiles.open(source, "wb") as target:
        while chunk := await audio.read(1024 * 1024):
            size += len(chunk)
            if size > max_bytes:
                raise HTTPException(413, f"Audio must be at most {request.app.state.settings.max_upload_mb} MB")
            await target.write(chunk)
    if not size:
        raise HTTPException(400, "The uploaded audio file is empty")
    return source


@router.post("/analyze-audio", response_model=AudioAnalysisResponse)
async def analyze_audio(request: Request, audio: UploadFile = File(...)) -> AudioAnalysisResponse:
    suffix = Path(audio.filename or "").suffix.lower()
    if suffix not in SUPPORTED:
        raise HTTPException(415, "Supported formats: .wav, .mp3, .m4a, .webm, .mp4, .mov")
    logger.info("[UPLOAD] file=%s", audio.filename)
    max_bytes = request.app.state.settings.max_upload_mb * 1024 * 1024
    size = 0
    try:
        with tempfile.TemporaryDirectory(prefix="person2-") as directory:
            source = Path(directory) / f"input{suffix}"
            normalized = Path(directory) / "normalized.wav"
            async with aiofiles.open(source, "wb") as target:
                while chunk := await audio.read(1024 * 1024):
                    size += len(chunk)
                    if size > max_bytes:
                        raise HTTPException(413, f"Audio must be at most {request.app.state.settings.max_upload_mb} MB")
                    await target.write(chunk)
            if not size:
                raise HTTPException(400, "The uploaded audio file is empty")
            return await request.app.state.pipeline.process_audio(str(source), str(normalized))
    except HTTPException:
        raise
    except (AudioError, STTError) as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        logger.exception("Pipeline request failed")
        raise HTTPException(500, "Audio processing failed") from exc
    finally:
        await audio.close()


@router.post("/analyze-audio-stream")
async def analyze_audio_stream(request: Request, audio: UploadFile = File(...)):
    suffix = Path(audio.filename or "").suffix.lower()
    if suffix not in SUPPORTED:
        raise HTTPException(415, "Supported formats: .wav, .mp3, .m4a, .webm, .mp4, .mov")
    directory = tempfile.mkdtemp(prefix="person2-stream-")
    try:
        source = await _save_upload(request, audio, directory, suffix)
    except Exception:
        shutil.rmtree(directory, ignore_errors=True)
        raise
    finally:
        await audio.close()

    async def events():
        try:
            async for event in request.app.state.pipeline.stream_audio(str(source), directory, 5):
                yield json.dumps(event) + "\n"
        except Exception as exc:
            logger.exception("Streaming pipeline failed")
            yield json.dumps({"type": "error", "detail": str(exc)}) + "\n"
        finally:
            shutil.rmtree(directory, ignore_errors=True)

    return StreamingResponse(events(), media_type="application/x-ndjson",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
