"""
Database repositories — CRUD operations for fact-check records.

All operations are no-ops if PostgreSQL is unavailable.
"""

import logging
from typing import Optional, List

from app.database.postgres import get_session, ClaimRecord

logger = logging.getLogger(__name__)


async def save_claim_result(result: dict) -> Optional[int]:
    """
    Persist a fact-check result to the database.

    Args:
        result: The full FactCheckResult dict.

    Returns:
        The database record ID, or None if DB is unavailable.
    """
    session = await get_session()
    if session is None:
        return None

    try:
        async with session:
            record = ClaimRecord(
                session_id=result.get("session_id", ""),
                segment_id=result.get("segment_id", ""),
                start_time=result.get("start", 0.0),
                end_time=result.get("end", 0.0),
                original_text=result.get("original_text", ""),
                canonical_claim=result.get("canonical_claim", ""),
                verdict=result.get("verdict", "INSUFFICIENT_EVIDENCE"),
                confidence=result.get("confidence", 0.0),
                explanation=result.get("explanation", ""),
                evidence=[e for e in result.get("evidence", [])],
                status=result.get("status", "verified"),
            )
            session.add(record)
            await session.commit()
            await session.refresh(record)
            logger.info("Saved claim record #%d: %s", record.id, record.canonical_claim[:60])
            return record.id

    except Exception as e:
        logger.error("Failed to save claim result: %s", e)
        return None


async def get_claims_by_session(session_id: str) -> List[dict]:
    """
    Retrieve all fact-check results for a given session.

    Args:
        session_id: The session identifier.

    Returns:
        List of result dicts, or empty list if DB is unavailable.
    """
    session = await get_session()
    if session is None:
        return []

    try:
        async with session:
            from sqlalchemy import select
            stmt = select(ClaimRecord).where(
                ClaimRecord.session_id == session_id
            ).order_by(ClaimRecord.start_time)
            result = await session.execute(stmt)
            records = result.scalars().all()

            return [
                {
                    "id": r.id,
                    "session_id": r.session_id,
                    "segment_id": r.segment_id,
                    "start": r.start_time,
                    "end": r.end_time,
                    "original_text": r.original_text,
                    "canonical_claim": r.canonical_claim,
                    "verdict": r.verdict,
                    "confidence": r.confidence,
                    "explanation": r.explanation,
                    "evidence": r.evidence,
                    "checked_at": str(r.checked_at) if r.checked_at else None,
                    "status": r.status,
                }
                for r in records
            ]

    except Exception as e:
        logger.error("Failed to retrieve claims for session %s: %s", session_id, e)
        return []
