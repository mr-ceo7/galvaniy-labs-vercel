"""Manual models for Galvaniy Labs."""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ManualPage(BaseModel):
    """A single page of the lab manual."""

    id: str
    page_number: int
    text: str
    image: Optional[str] = None  # Base64 string


class ManualMetadata(BaseModel):
    """Metadata about the uploaded manual."""

    name: str
    uploaded_at: Optional[str] = None
    uploaded_by: str = ""
    version: int = 1
    page_count: int = 0
