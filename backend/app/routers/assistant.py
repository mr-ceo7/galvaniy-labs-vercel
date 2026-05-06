"""Galvaniy Labs Backend — Lab Assistant Router."""

import logging
from typing import List, Dict, Any

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status

from app.middleware.auth import get_current_user, AuthenticatedUser
from app.services.gemini_service import chat_with_assistant
from app.dependencies import get_gemini_client

router = APIRouter(prefix="/api/assistant", tags=["assistant"])
logger = logging.getLogger(__name__)

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    experiment_code: str
    message: str
    chat_history: List[ChatMessage]

@router.post("/chat")
async def assistant_chat(
    request: ChatRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Handle chat messages for the Lab Assistant."""
    try:
        client = get_gemini_client()
        # Convert Pydantic models to dicts for the service
        history = [{"role": msg.role, "content": msg.content} for msg in request.chat_history]
        
        reply = await chat_with_assistant(
            client=client,
            experiment_code=request.experiment_code,
            message=request.message,
            chat_history=history,
        )
        
        return {"reply": reply}
    except Exception as e:
        logger.error(f"Assistant Chat Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
