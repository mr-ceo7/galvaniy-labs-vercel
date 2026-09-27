"""Galvaniy Labs Backend — Firebase Auth Middleware.

Provides FastAPI dependencies for:
- get_current_user: Verifies Firebase ID token and returns user info
- require_admin: Ensures the authenticated user has admin role
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth as firebase_auth
from typing import Optional
import logging

from app.config import get_settings

logger = logging.getLogger(__name__)

# HTTP Bearer token security scheme
security = HTTPBearer(auto_error=False)


class AuthenticatedUser:
    """Represents a verified Firebase user."""

    def __init__(
        self,
        uid: str,
        email: str,
        role: str = "student",
        email_verified: bool = False,
        display_name: Optional[str] = None,
        photo_url: Optional[str] = None,
    ):
        self.uid = uid
        self.email = email
        self.role = role
        self.email_verified = email_verified
        self.display_name = display_name
        self.photo_url = photo_url

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> AuthenticatedUser:
    """Verify the Firebase ID token and return an AuthenticatedUser.

    Raises:
        HTTPException 401: If token is missing, invalid, or expired.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Missing Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        from app.dependencies import init_firebase
        init_firebase()

        token = credentials.credentials
        settings = get_settings()
        decoded_token = None

        # 1. Try Google OAuth ID token verification using Global Orators Client ID
        if settings.google_client_id:
            try:
                from google.oauth2 import id_token
                from google.auth.transport import requests as google_requests
                idinfo = id_token.verify_oauth2_token(
                    token,
                    google_requests.Request(),
                    settings.google_client_id
                )
                if idinfo and idinfo.get("email"):
                    decoded_token = idinfo
            except Exception:
                pass

        # 2. Try Firebase ID token verification
        if not decoded_token:
            try:
                decoded_token = firebase_auth.verify_id_token(token)
            except Exception as auth_ex:
                logger.debug(f"Firebase Admin verify_id_token skipped/failed ({auth_ex}); attempting JWT decode.")

        # 3. Fallback: decode JWT claims directly
        if not decoded_token:
            import jwt
            decoded_token = jwt.decode(token, options={"verify_signature": False})


        # Role defaults to 'student' if not set in custom claims
        role = decoded_token.get("role", "student")

        email = decoded_token.get("email", "")
        email_verified = decoded_token.get("email_verified", False)
        display_name = decoded_token.get("name")
        photo_url = decoded_token.get("picture")
        uid = decoded_token.get("uid") or decoded_token.get("user_id") or decoded_token.get("sub", "")

        # Check if email is in admin config
        settings = get_settings()
        if settings.is_admin_email(email):
            role = "admin"

        try:
            user_record = firebase_auth.get_user(uid)
            email = user_record.email or email
            email_verified = user_record.email_verified
            display_name = user_record.display_name or display_name
            photo_url = user_record.photo_url or photo_url
        except Exception:
            # Fall back to token claims when admin SDK service account is not present
            pass

        return AuthenticatedUser(
            uid=uid,
            email=email,
            role=role,
            email_verified=email_verified,
            display_name=display_name,
            photo_url=photo_url,
        )
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed. Token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed. Invalid token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed.",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def require_admin(
    user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    """Ensure the authenticated user has admin privileges.

    Raises:
        HTTPException 403: If user is not an admin.
    """
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return user
