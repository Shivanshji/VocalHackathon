"""
PostgreSQL database engine and session management.

Uses SQLAlchemy async engine with asyncpg driver.
Gracefully degrades: if Postgres is unavailable, the app runs
without persistence (results are still returned, just not stored).
"""

import logging
from typing import Optional

from sqlalchemy import Column, DateTime, Float, Integer, String, Text, JSON, func
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

logger = logging.getLogger(__name__)


# --- SQLAlchemy Base ---

class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


# --- ORM Models ---

class ClaimRecord(Base):
    """Persisted fact-check record."""
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(128), nullable=False, index=True)
    segment_id = Column(String(128), nullable=False)
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    original_text = Column(Text, nullable=False)
    canonical_claim = Column(Text, nullable=False, index=True)
    verdict = Column(String(32), nullable=False)
    confidence = Column(Float, nullable=False)
    explanation = Column(Text, nullable=True)
    evidence = Column(JSON, nullable=True)
    checked_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String(32), default="verified")


# --- Engine & Session ---

_engine = None
_session_factory = None
_available: Optional[bool] = None


async def init_db() -> bool:
    """
    Initialize the database engine and create tables.
    Returns True if successful, False if Postgres is unavailable.
    """
    global _engine, _session_factory, _available

    try:
        _engine = create_async_engine(
            settings.database_url,
            echo=False,
            pool_size=5,
            max_overflow=10,
        )

        # Create tables
        async with _engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        _session_factory = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)
        _available = True
        logger.info("PostgreSQL connected and tables created")
        return True

    except Exception as e:
        logger.warning("PostgreSQL unavailable (%s). Running without persistence.", e)
        _available = False
        return False


async def get_session() -> Optional[AsyncSession]:
    """Get an async database session, or None if DB is unavailable."""
    if not _available or _session_factory is None:
        return None
    return _session_factory()


async def close_db():
    """Close the database engine."""
    global _engine, _available
    if _engine:
        await _engine.dispose()
        _engine = None
        _available = None
        logger.info("Database connection closed")
