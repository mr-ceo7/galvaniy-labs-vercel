"""Settings models for Galvaniy Labs."""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class GlobalSettings(BaseModel):
    """Global application settings stored in Firestore."""

    default_daily_limit: int = 3
    custom_instructions: str = ""
    api_provider: str = "gemini"  # 'gemini' or 'custom'
    custom_api_url: str = ""
    enable_parallel_generation: Optional[bool] = True
    last_updated: Optional[str] = None
    updated_by: str = ""


class GlobalSettingsUpdate(BaseModel):
    """Partial update for global settings."""

    default_daily_limit: Optional[int] = None
    custom_instructions: Optional[str] = None
    api_provider: Optional[str] = None
    custom_api_url: Optional[str] = None
    enable_parallel_generation: Optional[bool] = None


class AdminStats(BaseModel):
    """Dashboard stats for admin panel."""

    total_students: int = 0
    total_reports: int = 0
    active_students: int = 0
    revoked_students: int = 0
    total_lab_sessions: int = 0
    manual_lab_sessions: int = 0
    auto_lab_sessions: int = 0
    students_using_virtual_lab: int = 0
