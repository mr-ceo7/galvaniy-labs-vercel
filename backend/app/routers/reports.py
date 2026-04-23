"""Galvaniy Labs Backend — Reports Router."""

import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List

from app.middleware.auth import get_current_user, AuthenticatedUser
from app.services.firestore_service import firestore_service
from app.services.gemini_service import generate_lab_report
from app.dependencies import get_gemini_client
from app.models.report import ReportGenerateRequest, Report, ReportResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.post("/generate", response_model=ReportResponse)
async def generate_report(
    request: ReportGenerateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Generate a lab report for the given experiment code.

    - Validates rate limit
    - Fetches manual from Firestore
    - Calls Gemini to generate report
    - Saves report to Firestore
    - Increments user's report count
    """
    experiment_code = request.experiment_code.strip().upper()

    # Check if user is revoked
    profile = await firestore_service.get_user_profile(user.uid)
    if profile and profile.is_revoked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been revoked. Please contact an administrator.",
        )

    # Check rate limit (admin bypass)
    if not user.is_admin and profile:
        settings = await firestore_service.get_settings()
        limit = profile.custom_limit if profile.custom_limit is not None else settings.default_daily_limit

        # Import rate limiter
        from app.utils.rate_limiter import check_rate_limit
        if not check_rate_limit(user.uid, limit):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="You have reached your daily limit. Please try again tomorrow.",
            )

    # Fetch manual
    pages = await firestore_service.get_manual_pages()
    if not pages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No lab manual found. Please contact the administrator to upload the manual.",
        )

    manual_text = "\n\n".join(p.text for p in pages)
    logger.info(f"[Reports] Manual loaded: {len(pages)} pages, {len(manual_text)} chars")

    # Check if parallel generation is enabled
    settings = await firestore_service.get_settings()
    parallel = settings.enable_parallel_generation if settings.enable_parallel_generation is not None else True

    # Generate report
    try:
        if settings.api_provider == "custom":
            from app.services.custom_api_service import generate_lab_report as generate_custom_report
            content = await generate_custom_report(
                settings.custom_api_url, manual_text, experiment_code, parallel=parallel
            )
        else:
            gemini_client = get_gemini_client()
            content = await generate_lab_report(gemini_client, manual_text, experiment_code, parallel=parallel)
    except Exception as e:
        logger.error(f"[Reports] Generation failed: {e}")
        error_msg = str(e)
        
        # DEBUG: Write exact error to file so Antigravity can read it
        with open("last_error.txt", "w") as f:
            f.write(error_msg)
            
        if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Gemini API quota exceeded. Please check your Google AI Studio billing or try again later.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Report generation failed: {error_msg}",
        )

    # Validate content is valid JSON
    try:
        json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI generated invalid data structure. Please try again.",
        )

    # Create report
    report_id = str(int(datetime.utcnow().timestamp() * 1000))
    report = Report(
        id=report_id,
        experiment_code=experiment_code,
        date=datetime.utcnow().isoformat(),
        content=content,
        user_uid=user.uid,
    )

    # Save to Firestore
    await firestore_service.save_report(user.uid, report)

    # Increment report count
    await firestore_service.increment_report_count(user.uid)

    # Increment rate limit counter
    if not user.is_admin:
        from app.utils.rate_limiter import increment_rate_limit
        increment_rate_limit(user.uid)

    return ReportResponse(
        id=report.id,
        experiment_code=report.experiment_code,
        date=report.date,
        content=report.content,
    )


@router.get("", response_model=List[ReportResponse])
async def list_reports(
    user: AuthenticatedUser = Depends(get_current_user),
):
    """List all reports for the current user."""
    reports = await firestore_service.get_user_reports(user.uid)

    return [
        ReportResponse(
            id=r.id,
            experiment_code=r.experiment_code,
            date=r.date,
            content=r.content,
        )
        for r in reports
    ]
