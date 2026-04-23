"""User models for Galvaniy Labs."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class UserProfile(BaseModel):
    """User profile stored in Firestore."""

    uid: str
    email: str
    role: str = "student"
    display_name: Optional[str] = None
    photo_url: Optional[str] = None
    custom_limit: Optional[int] = None
    is_revoked: bool = False
    reports_generated: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: datetime = Field(default_factory=datetime.utcnow)


class UserProfileUpdate(BaseModel):
    """Partial update for user profile (admin operations)."""

    custom_limit: Optional[int] = None
    is_revoked: Optional[bool] = None
    role: Optional[str] = None


class UserResponse(BaseModel):
    """User profile returned to client."""

    uid: str
    email: str
    role: str
    display_name: Optional[str] = None
    photo_url: Optional[str] = None
    custom_limit: Optional[int] = None
    is_revoked: bool = False
    reports_generated: int = 0
    created_at: str = ""
    last_login: str = ""
