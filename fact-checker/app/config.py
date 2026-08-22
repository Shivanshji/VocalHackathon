"""
Centralized configuration — loads from .env file and environment variables.
"""

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    # --- Required API keys ---
    gemini_api_key: str = Field(..., description="Google Gemini API key")
    tavily_api_key: str = Field(..., description="Tavily search API key")

    # --- LLM settings ---
    llm_model: str = Field(default="gemini-2.0-flash", description="Gemini model name")

    # --- Redis (optional — graceful fallback if unavailable) ---
    redis_url: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL",
    )

    # --- PostgreSQL (optional — graceful fallback if unavailable) ---
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/factchecker",
        description="PostgreSQL async connection URL",
    )

    # --- Logging ---
    log_level: str = Field(default="INFO", description="Log level")

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


# Singleton — import this everywhere
settings = Settings()
