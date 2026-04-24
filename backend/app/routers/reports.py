"""Galvaniy Labs Backend — Reports Router."""

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Tuple

from fastapi import APIRouter, Depends, HTTPException, status

from app.middleware.auth import get_current_user, AuthenticatedUser
from app.services.firestore_service import firestore_service
from app.services.gemini_service import generate_lab_report
from app.dependencies import get_gemini_client
from app.models.report import ReportGenerateRequest, Report, ReportResponse
from app.models.session import LabSessionResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/reports", tags=["reports"])


async def _get_profile_and_settings(user: AuthenticatedUser):
    """Load the current user's profile and global settings."""
    profile = await firestore_service.get_user_profile(user.uid)
    settings = await firestore_service.get_settings()
    return profile, settings


async def _enforce_generation_access(user: AuthenticatedUser):
    """Validate revoke status and daily rate limits before report generation."""
    profile, settings = await _get_profile_and_settings(user)

    if profile and profile.is_revoked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been revoked. Please contact an administrator.",
        )

    if not user.is_admin and profile:
        limit = profile.custom_limit if profile.custom_limit is not None else settings.default_daily_limit
        from app.utils.rate_limiter import check_rate_limit

        if not check_rate_limit(user.uid, limit):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="You have reached your daily limit. Please try again tomorrow.",
            )

    return profile, settings


async def _load_manual_text() -> str:
    """Load the active manual from Firestore."""
    pages = await firestore_service.get_manual_pages()
    if not pages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No lab manual found. Please contact the administrator to upload the manual.",
        )

    manual_text = "\n\n".join(p.text for p in pages)
    logger.info(f"[Reports] Manual loaded: {len(pages)} pages, {len(manual_text)} chars")
    return manual_text


async def _generate_report_content(
    manual_text: str,
    experiment_code: str,
    parallel: bool,
    settings,
) -> str:
    """Generate a report payload through the configured provider."""
    try:
        if settings.api_provider == "custom":
            from app.services.custom_api_service import generate_lab_report as generate_custom_report

            return await generate_custom_report(
                settings.custom_api_url, manual_text, experiment_code, parallel=False
            )

        gemini_client = get_gemini_client()
        return await generate_lab_report(gemini_client, manual_text, experiment_code, parallel=parallel)
    except Exception as e:
        logger.error(f"[Reports] Generation failed: {e}")
        error_type = type(e).__name__
        error_msg = repr(e)
        full_error = f"{error_type}: {error_msg}" if error_msg else error_type

        import traceback
        with open("last_error.txt", "w") as f:
            f.write(traceback.format_exc())

        if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Gemini API quota exceeded. Please check your Google AI Studio billing or try again later.",
            )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Report generation failed: {full_error}",
        )


def _validate_json_content(content: str) -> Dict[str, Any]:
    """Parse report JSON content and fail with a clear API error if invalid."""
    try:
        parsed = json.loads(content)
        if not isinstance(parsed, dict):
            raise ValueError("Report payload must be a JSON object")
        return parsed
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI generated invalid data structure. Please try again.",
        )


async def _persist_generated_report(
    user: AuthenticatedUser,
    experiment_code: str,
    content: str,
) -> ReportResponse:
    """Save a generated report and update counters."""
    report_id = str(int(datetime.utcnow().timestamp() * 1000))
    report = Report(
        id=report_id,
        experiment_code=experiment_code,
        date=datetime.utcnow().isoformat(),
        content=content,
        user_uid=user.uid,
    )

    await firestore_service.save_report(user.uid, report)
    await firestore_service.increment_report_count(user.uid)

    if not user.is_admin:
        from app.utils.rate_limiter import increment_rate_limit

        increment_rate_limit(user.uid)

    return ReportResponse(
        id=report.id,
        experiment_code=report.experiment_code,
        date=report.date,
        content=report.content,
    )


def _is_numeric(value: Any) -> bool:
    """Check whether a session cell can be interpreted as numeric."""
    if isinstance(value, (int, float)):
        return True
    if isinstance(value, str):
        try:
            float(value)
            return True
        except ValueError:
            return False
    return False


def _stringify_cell(value: Any) -> str:
    """Normalize session table values to strings for report content."""
    if value is None:
        return ""
    if isinstance(value, float):
        return f"{value:.6g}"
    return str(value)


def _inject_session_data_into_report(
    report_data: Dict[str, Any],
    session: LabSessionResponse,
) -> Dict[str, Any]:
    """Replace report tables with data captured in a saved virtual lab session."""
    if not session.data_points:
        return report_data

    headers = list(session.data_points[0].keys())
    rows = [
        [_stringify_cell(point.get(header, "")) for header in headers]
        for point in session.data_points
    ]

    report_data["tables"] = [{
        "title": f"Virtual Lab Session Data — {session.experiment_code}",
        "headers": headers,
        "rows": rows,
    }]

    numeric_indices = [
        index
        for index, header in enumerate(headers)
        if any(_is_numeric(point.get(header)) for point in session.data_points)
    ]
    if len(numeric_indices) >= 2:
        report_data["graphConfig"] = {
            "tableIndex": 0,
            "xColumnIndex": numeric_indices[0],
            "yColumnIndex": numeric_indices[1],
            "title": f"{headers[numeric_indices[1]]} vs {headers[numeric_indices[0]]}",
        }

    if session.control_values:
        report_data["controls"] = [
            {
                "id": key,
                "label": key.replace("_", " ").title(),
                "val": value,
            }
            for key, value in session.control_values.items()
        ]

    note = (
        f" This report uses data collected from a saved virtual lab session "
        f"({session.mode} mode, {session.data_point_count} recorded points)."
    )
    discussion = report_data.get("discussion", "")
    report_data["discussion"] = (discussion + note).strip()
    report_data["sessionSource"] = {
        "sessionId": session.id,
        "mode": session.mode,
        "savedAt": session.saved_at,
    }
    return report_data


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
    _, settings = await _enforce_generation_access(user)
    manual_text = await _load_manual_text()
    parallel = settings.enable_parallel_generation if settings.enable_parallel_generation is not None else True

    content = await _generate_report_content(manual_text, experiment_code, parallel, settings)
    _validate_json_content(content)
    return await _persist_generated_report(user, experiment_code, content)


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


@router.post("/lab-session")
async def save_lab_session(
    session: dict,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Save a Virtual Lab experiment session to Firestore."""
    try:
        session_data = {
            "user_uid": user.uid,
            "experiment_code": session.get("experiment_code", ""),
            "mode": session.get("mode", "manual"),
            "started_at": session.get("started_at", ""),
            "completed_at": session.get("completed_at", ""),
            "data_points": session.get("data_points", []),
            "control_values": session.get("control_values", {}),
            "session_events": session.get("session_events", []),
            "saved_at": datetime.utcnow().isoformat(),
        }
        session_id = await firestore_service.save_lab_session(user.uid, session_data)
        return {"status": "ok", "message": "Session saved successfully", "session_id": session_id}
    except Exception as e:
        logger.error(f"[Reports] Failed to save lab session: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save session: {str(e)}",
        )


@router.get("/lab-sessions", response_model=List[LabSessionResponse])
async def list_lab_sessions(
    user: AuthenticatedUser = Depends(get_current_user),
):
    """List saved virtual lab sessions for the current user."""
    return await firestore_service.get_user_lab_sessions(user.uid)


@router.get("/lab-sessions/{session_id}", response_model=LabSessionResponse)
async def get_lab_session(
    session_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Get a single saved virtual lab session."""
    session = await firestore_service.get_lab_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lab session not found.",
        )

    if session.user_uid != user.uid and not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this lab session.",
        )

    return session


@router.post("/lab-sessions/{session_id}/generate-report", response_model=ReportResponse)
async def generate_report_from_session(
    session_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Generate a report using data from a saved virtual lab session."""
    session = await firestore_service.get_lab_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lab session not found.",
        )

    if session.user_uid != user.uid and not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this lab session.",
        )

    experiment_code = session.experiment_code.strip().upper()
    _, settings = await _enforce_generation_access(user)
    manual_text = await _load_manual_text()
    parallel = settings.enable_parallel_generation if settings.enable_parallel_generation is not None else True

    content = await _generate_report_content(manual_text, experiment_code, parallel, settings)
    report_data = _validate_json_content(content)
    report_data = _inject_session_data_into_report(report_data, session)

    return await _persist_generated_report(
        user,
        experiment_code,
        json.dumps(report_data),
    )
