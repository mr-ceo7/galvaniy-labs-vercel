"""Galvaniy Labs Backend — Server-Side Rate Limiter.

In-memory daily rate limiting per user.
Resets at midnight UTC. For persistence across restarts,
the Firestore reportsGenerated field serves as a fallback.
"""

from datetime import datetime, date
from typing import Dict
import logging

logger = logging.getLogger(__name__)

# In-memory store: { "uid": { "date": "2026-01-01", "count": 3 } }
_rate_limits: Dict[str, Dict[str, any]] = {}


def _get_today() -> str:
    """Get today's date string (UTC)."""
    return date.today().isoformat()


def check_rate_limit(uid: str, limit: int) -> bool:
    """Check if a user is within their daily rate limit.

    Args:
        uid: The user's Firebase UID.
        limit: The maximum number of reports per day.

    Returns:
        True if the user can still generate reports, False if limit reached.
    """
    if limit <= 0:
        return False

    today = _get_today()
    entry = _rate_limits.get(uid)

    if entry is None or entry.get("date") != today:
        # No entry or from a different day — user hasn't generated today
        return True

    return entry["count"] < limit


def increment_rate_limit(uid: str) -> int:
    """Increment the daily usage count for a user.

    Args:
        uid: The user's Firebase UID.

    Returns:
        The new count after incrementing.
    """
    today = _get_today()
    entry = _rate_limits.get(uid)

    if entry is None or entry.get("date") != today:
        _rate_limits[uid] = {"date": today, "count": 1}
        return 1

    entry["count"] += 1
    return entry["count"]


def get_daily_count(uid: str) -> int:
    """Get the current daily usage count for a user.

    Args:
        uid: The user's Firebase UID.

    Returns:
        Number of reports generated today.
    """
    today = _get_today()
    entry = _rate_limits.get(uid)

    if entry is None or entry.get("date") != today:
        return 0

    return entry["count"]


def reset_rate_limits() -> None:
    """Clear all rate limit entries (used in testing)."""
    global _rate_limits
    _rate_limits = {}
