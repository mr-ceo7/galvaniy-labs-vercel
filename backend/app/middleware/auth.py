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
    """Verify Firebase ID token and return authenticated user.

    Extracts the Bearer token from the Authorization header,
    verifies it with Firebase Admin SDK, and determines the user's role.

    Raises:
        HTTPException 401: If token is missing, invalid, or expired.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    try:
        # Verify the Firebase ID token
        decoded_token = firebase_auth.verify_id_token(token)
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except firebase_auth.RevokedIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed. Please try again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    uid = decoded_token.get("uid", "")
    email = decoded_token.get("email", "")
    email_verified = decoded_token.get("email_verified", False)
    display_name = decoded_token.get("name", None)
    photo_url = decoded_token.get("picture", None)

    # Determine role based on admin config
    settings = get_settings()
    role = "admin" if settings.is_admin_email(email) else "student"

    return AuthenticatedUser(
        uid=uid,
        email=email,
        role=role,
        email_verified=email_verified,
        display_name=display_name,
        photo_url=photo_url,
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
