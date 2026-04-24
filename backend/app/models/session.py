"""Virtual lab session models for Galvaniy Labs."""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class SessionEvent(BaseModel):
    """Recorded virtual lab interaction."""

    time: float = 0
    type: str = ""
    data: Dict[str, Any] = {}


class LabSessionResponse(BaseModel):
    """Student-visible saved lab session."""

    id: str
    user_uid: str
    experiment_code: str
    mode: str = "manual"
    started_at: str = ""
    completed_at: str = ""
    saved_at: str = ""
    data_points: List[Dict[str, Any]] = []
    control_values: Dict[str, float] = {}
    session_events: List[SessionEvent] = []
    data_point_count: int = 0
    event_count: int = 0


class AdminLabSessionResponse(LabSessionResponse):
    """Admin-visible lab session with owner metadata."""

    user_email: str = ""
    display_name: Optional[str] = None
