"""Galvaniy Labs Backend — Lab Assistant Router."""

import logging
from typing import List, Dict, Any, Optional

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status

from app.middleware.auth import get_optional_user, AuthenticatedUser
from app.services.gemini_service import chat_with_assistant
from app.dependencies import get_gemini_client

router = APIRouter(prefix="/api/assistant", tags=["assistant"])
logger = logging.getLogger(__name__)

class ChatMessage(BaseModel):
    role: str
    content: str

class LabState(BaseModel):
    placedComponents: List[str] = []
    controlValues: Dict[str, float] = {}
    dataCount: int = 0
    isRunning: bool = False

class ChatRequest(BaseModel):
    experiment_code: str
    message: str
    chat_history: List[ChatMessage]
    lab_state: Optional[LabState] = None

@router.post("/chat")
async def assistant_chat(
    request: ChatRequest,
    user: Optional[AuthenticatedUser] = Depends(get_optional_user),
):
    """Handle chat messages for the Lab Assistant. Returns structured JSON with actions."""
    try:
        client = get_gemini_client()
        history = [{"role": msg.role, "content": msg.content} for msg in request.chat_history]
        lab_state_dict = request.lab_state.model_dump() if request.lab_state else None
        
        result = await chat_with_assistant(
            client=client,
            experiment_code=request.experiment_code,
            message=request.message,
            chat_history=history,
            lab_state=lab_state_dict,
        )
        
        return result
    except Exception as e:
        logger.error(f"Assistant Chat Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
