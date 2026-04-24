"""Galvaniy Labs Backend — Virtual lab router."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.middleware.auth import get_current_user, AuthenticatedUser
from app.models.report import ReportGenerateRequest
from app.services.physics_engine import get_lab_setup, get_fallback_lab_setup
from app.services.firestore_service import firestore_service
from app.services.gemini_service import generate_lab_config as generate_gemini_lab_config
from app.services.custom_api_service import generate_lab_config as generate_custom_lab_config
from app.dependencies import get_gemini_client

router = APIRouter(prefix="/api", tags=["lab"])
logger = logging.getLogger(__name__)


@router.post("/lab-setup")
async def lab_setup(
    request: ReportGenerateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Return the best available virtual lab configuration for an experiment."""
    experiment_code = request.experiment_code.strip().upper()
    setup = await get_lab_setup(experiment_code)

    if not setup:
        try:
            pages = await firestore_service.get_manual_pages()
            settings = await firestore_service.get_settings()
            manual_text = "\n\n".join(page.text for page in pages)

            if manual_text.strip():
                if settings.api_provider == "custom":
                    setup = await generate_custom_lab_config(
                        settings.custom_api_url,
                        manual_text,
                        experiment_code,
                    )
                else:
                    setup = await generate_gemini_lab_config(
                        get_gemini_client(),
                        manual_text,
                        experiment_code,
                    )
        except Exception as exc:
            logger.warning("[Lab] AI lab config generation failed for %s: %s", experiment_code, exc)

    if not setup:
        setup = get_fallback_lab_setup(experiment_code)
        if not setup:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No lab setup available for {experiment_code}.",
            )

    return {
        "experiment_code": experiment_code,
        "mode": setup.get("tier", "builtin"),
        "requested_by": user.uid,
        "lab_config": setup,
    }
