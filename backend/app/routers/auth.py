"""Galvaniy Labs Backend — Auth Router."""

from fastapi import APIRouter, Depends, HTTPException
from app.middleware.auth import get_current_user, AuthenticatedUser
from app.services.firestore_service import firestore_service
from app.models.user import UserProfile, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Get the current authenticated user's profile."""
    # Fetch full profile from Firestore
    profile = await firestore_service.get_user_profile(user.uid)

    if profile:
        return UserResponse(
            uid=profile.uid,
            email=profile.email,
            role=profile.role,
            display_name=profile.display_name,
            photo_url=profile.photo_url,
            custom_limit=profile.custom_limit,
            is_revoked=profile.is_revoked,
            reports_generated=profile.reports_generated,
            created_at=profile.created_at.isoformat() if profile.created_at else "",
            last_login=profile.last_login.isoformat() if profile.last_login else "",
        )

    # Fallback: return info from token if no Firestore profile exists
    return UserResponse(
        uid=user.uid,
        email=user.email,
        role=user.role,
        display_name=user.display_name,
        photo_url=user.photo_url,
    )


@router.post("/profile", response_model=UserResponse)
async def create_or_update_profile(
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Create user profile on first login or update last login."""
    existing = await firestore_service.get_user_profile(user.uid)

    if existing:
        # Update last login
        await firestore_service.update_last_login(user.uid)
        existing.last_login = existing.last_login  # refresh
        return UserResponse(
            uid=existing.uid,
            email=existing.email,
            role=existing.role,
            display_name=existing.display_name,
            photo_url=existing.photo_url,
            custom_limit=existing.custom_limit,
            is_revoked=existing.is_revoked,
            reports_generated=existing.reports_generated,
            created_at=existing.created_at.isoformat() if existing.created_at else "",
            last_login=existing.last_login.isoformat() if existing.last_login else "",
        )

    # Create new profile
    profile = UserProfile(
        uid=user.uid,
        email=user.email,
        role=user.role,
        display_name=user.display_name,
        photo_url=user.photo_url,
    )
    await firestore_service.create_user_profile(profile)

    return UserResponse(
        uid=profile.uid,
        email=profile.email,
        role=profile.role,
        display_name=profile.display_name,
        photo_url=profile.photo_url,
    )
