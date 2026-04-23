"""Galvaniy Labs Backend — Admin Router."""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status

from app.middleware.auth import require_admin, AuthenticatedUser
from app.services.firestore_service import firestore_service
from app.models.user import UserResponse, UserProfileUpdate
from app.models.settings import GlobalSettings, GlobalSettingsUpdate, AdminStats
from app.models.manual import ManualMetadata, ManualPage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ==================== USERS ====================

@router.get("/users", response_model=List[UserResponse])
async def list_users(admin: AuthenticatedUser = Depends(require_admin)):
    """List all users (admin only)."""
    users = await firestore_service.get_all_users()
    return [
        UserResponse(
            uid=u.uid,
            email=u.email,
            role=u.role,
            display_name=u.display_name,
            photo_url=u.photo_url,
            custom_limit=u.custom_limit,
            is_revoked=u.is_revoked,
            reports_generated=u.reports_generated,
            created_at=u.created_at.isoformat() if u.created_at else "",
            last_login=u.last_login.isoformat() if u.last_login else "",
        )
        for u in users
    ]


@router.patch("/users/{uid}")
async def update_user(
    uid: str,
    update: UserProfileUpdate,
    admin: AuthenticatedUser = Depends(require_admin),
):
    """Update a user's profile (admin only). Supports revoke, custom limit, role."""
    updates = {}
    if update.custom_limit is not None:
        updates["custom_limit"] = update.custom_limit
    if update.is_revoked is not None:
        updates["is_revoked"] = update.is_revoked
    if update.role is not None:
        updates["role"] = update.role

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No updates provided.",
        )

    await firestore_service.update_user_profile(uid, updates)
    return {"status": "updated", "uid": uid}


# ==================== STATS ====================

@router.get("/stats", response_model=AdminStats)
async def get_admin_stats(admin: AuthenticatedUser = Depends(require_admin)):
    """Get admin dashboard statistics."""
    return await firestore_service.get_admin_stats()


# ==================== SETTINGS ====================

@router.get("/settings", response_model=GlobalSettings)
async def get_settings(admin: AuthenticatedUser = Depends(require_admin)):
    """Get global application settings."""
    return await firestore_service.get_settings()


@router.put("/settings")
async def update_settings(
    update: GlobalSettingsUpdate,
    admin: AuthenticatedUser = Depends(require_admin),
):
    """Update global application settings (admin only)."""
    updates = update.model_dump(exclude_none=True)

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No settings to update.",
        )

    await firestore_service.update_settings(updates, admin.email)
    return {"status": "settings_updated"}


# ==================== MANUAL ====================

@router.get("/manual/metadata", response_model=Optional[ManualMetadata])
async def get_manual_metadata(admin: AuthenticatedUser = Depends(require_admin)):
    """Get uploaded manual metadata."""
    return await firestore_service.get_manual_metadata()


@router.post("/manual/upload")
async def upload_manual(
    file: UploadFile = File(...),
    admin: AuthenticatedUser = Depends(require_admin),
):
    """Upload a lab manual PDF.

    Extracts text from the PDF and stores pages in Firestore.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file provided.",
        )

    # Read file content
    content = await file.read()

    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file.",
        )

    # Extract text from PDF
    try:
        pages = _extract_text_from_pdf(content, file.filename)
    except Exception as e:
        logger.error(f"PDF extraction failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to extract text from PDF: {str(e)}",
        )

    if not pages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not extract any text from the PDF.",
        )

    # Upload to Firestore
    await firestore_service.upload_manual(pages, file.filename, admin.email)

    return {
        "status": "uploaded",
        "filename": file.filename,
        "page_count": len(pages),
    }


@router.delete("/manual")
async def clear_manual(admin: AuthenticatedUser = Depends(require_admin)):
    """Clear the uploaded manual."""
    await firestore_service.clear_manual()
    return {"status": "manual_cleared"}


def _extract_text_from_pdf(content: bytes, filename: str) -> List[ManualPage]:
    """Extract text from PDF bytes.

    Uses a simple approach - for production, consider PyPDF2 or pdfplumber.
    For now, we treat the uploaded content as raw text if PDF parsing is unavailable.
    """
    pages = []

    try:
        # Try PyPDF2 first
        import io
        from PyPDF2 import PdfReader

        reader = PdfReader(io.BytesIO(content))
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            if text.strip():
                pages.append(ManualPage(
                    id=f"page_{i + 1}",
                    page_number=i + 1,
                    text=text,
                ))

    except ImportError:
        # PyPDF2 not installed — treat as plain text
        text = content.decode("utf-8", errors="ignore")
        if text.strip():
            # Split into chunks of ~2000 chars as "pages"
            chunk_size = 2000
            for i in range(0, len(text), chunk_size):
                chunk = text[i : i + chunk_size]
                if chunk.strip():
                    page_num = (i // chunk_size) + 1
                    pages.append(ManualPage(
                        id=f"page_{page_num}",
                        page_number=page_num,
                        text=chunk,
                    ))

    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
        # Fallback: treat as text
        text = content.decode("utf-8", errors="ignore")
        if text.strip():
            pages.append(ManualPage(
                id="page_1",
                page_number=1,
                text=text,
            ))

    return pages
