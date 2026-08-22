import asyncio
from pathlib import Path


class AudioError(Exception):
    pass


async def normalize_audio(input_path: str, output_path: str) -> str:
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", input_path,
               "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", output_path]
    try:
        process = await asyncio.create_subprocess_exec(*command, stdout=asyncio.subprocess.PIPE,
                                                       stderr=asyncio.subprocess.PIPE)
    except FileNotFoundError as exc:
        raise AudioError("FFmpeg is unavailable. Install it and ensure it is on PATH.") from exc
    _, stderr = await process.communicate()
    if process.returncode or not Path(output_path).is_file():
        message = stderr.decode(errors="replace").strip()
        raise AudioError(f"Could not decode the audio: {message or 'invalid audio'}")
    return output_path


async def split_audio(input_path: str, output_directory: str, chunk_seconds: int = 5) -> list[Path]:
    pattern = str(Path(output_directory) / "chunk_%05d.wav")
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", input_path,
               "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", "-f", "segment",
               "-segment_time", str(chunk_seconds), "-reset_timestamps", "1", pattern]
    try:
        process = await asyncio.create_subprocess_exec(*command, stdout=asyncio.subprocess.PIPE,
                                                       stderr=asyncio.subprocess.PIPE)
    except FileNotFoundError as exc:
        raise AudioError("FFmpeg is unavailable. Install it and ensure it is on PATH.") from exc
    _, stderr = await process.communicate()
    chunks = sorted(Path(output_directory).glob("chunk_*.wav"))
    if process.returncode or not chunks:
        message = stderr.decode(errors="replace").strip()
        raise AudioError(f"Could not decode the audio: {message or 'invalid audio'}")
    return chunks
