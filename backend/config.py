from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    host: str = "0.0.0.0"
    port: int = 8000
    whisper_model: str = "small"
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"
    whisper_vad_filter: bool = False
    whisper_vad_min_silence_ms: int = 800
    indictrans_model: str = "ai4bharat/indictrans2-indic-en-dist-200M"
    indictrans_device: str = "cpu"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    fact_checker_url: str = "http://127.0.0.1:8001"
    ai_timeout_seconds: float = 30
    max_upload_mb: int = 50
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
