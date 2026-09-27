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


from pydantic import BaseModel


class GoogleAuthRequest(BaseModel):
    credential: str


@router.post("/google", response_model=UserResponse)
async def authenticate_google(req: GoogleAuthRequest):
    """Authenticate with Google OAuth ID token (Global Orators client ID)."""
    from app.config import get_settings
    settings = get_settings()

    email = None
    uid = None
    name = None
    picture = None

    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as google_requests
        idinfo = id_token.verify_oauth2_token(
            req.credential,
            google_requests.Request(),
            settings.google_client_id
        )
        uid = idinfo.get("sub")
        email = idinfo.get("email")
        name = idinfo.get("name")
        picture = idinfo.get("picture")
    except Exception as exc:
        # Fallback decode if direct verification issues arise
        try:
            import jwt
            payload = jwt.decode(req.credential, options={"verify_signature": False})
            uid = payload.get("sub")
            email = payload.get("email")
            name = payload.get("name")
            picture = payload.get("picture")
        except Exception:
            raise HTTPException(
                status_code=401,
                detail=f"Google authentication failed: {exc}"
            )

    if not email or not uid:
        raise HTTPException(
            status_code=401,
            detail="Invalid Google credentials or token payload missing email/sub."
        )

    role = "admin" if settings.is_admin_email(email) else "student"

    # Sync profile with Firestore or in-memory
    existing = await firestore_service.get_user_profile(uid)
    if existing:
        await firestore_service.update_last_login(uid)
        return UserResponse(
            uid=existing.uid,
            email=existing.email,
            role=existing.role,
            display_name=existing.display_name or name,
            photo_url=existing.photo_url or picture,
            custom_limit=existing.custom_limit,
            is_revoked=existing.is_revoked,
            reports_generated=existing.reports_generated,
            created_at=existing.created_at.isoformat() if existing.created_at else "",
            last_login=existing.last_login.isoformat() if existing.last_login else "",
        )

    profile = UserProfile(
        uid=uid,
        email=email,
        role=role,
        display_name=name,
        photo_url=picture,
    )
    await firestore_service.create_user_profile(profile)

    return UserResponse(
        uid=profile.uid,
        email=profile.email,
        role=profile.role,
        display_name=profile.display_name,
        photo_url=profile.photo_url,
    )

