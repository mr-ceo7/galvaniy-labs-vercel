"""Tests for Stage 2: Auth Middleware."""

import os
import sys
import pytest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.middleware.auth import AuthenticatedUser, get_current_user, require_admin
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials


class TestAuthenticatedUser:
    """Test the AuthenticatedUser model."""

    def test_student_role_default(self):
        """Default role should be student."""
        user = AuthenticatedUser(uid="123", email="test@test.com")
        assert user.role == "student"
        assert user.is_admin is False

    def test_admin_role(self):
        """Admin role should be recognized."""
        user = AuthenticatedUser(uid="123", email="admin@test.com", role="admin")
        assert user.role == "admin"
        assert user.is_admin is True

    def test_user_fields(self):
        """All fields should be set correctly."""
        user = AuthenticatedUser(
            uid="abc-123",
            email="user@test.com",
            role="student",
            email_verified=True,
            display_name="Test User",
            photo_url="https://example.com/photo.jpg",
        )
        assert user.uid == "abc-123"
        assert user.email == "user@test.com"
        assert user.email_verified is True
        assert user.display_name == "Test User"
        assert user.photo_url == "https://example.com/photo.jpg"


class TestGetCurrentUser:
    """Test the get_current_user dependency."""

    @pytest.mark.asyncio
    async def test_missing_credentials(self):
        """Should raise 401 when no credentials provided."""
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(credentials=None)
        assert exc_info.value.status_code == 401
        assert "Authentication required" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_expired_token(self):
        """Should raise 401 for expired tokens."""
        from firebase_admin import auth as firebase_auth

        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="expired-token")

        with patch.object(
            firebase_auth,
            "verify_id_token",
            side_effect=firebase_auth.ExpiredIdTokenError("Token expired", cause=None),
        ):
            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(credentials=creds)
            assert exc_info.value.status_code == 401
            assert "expired" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_invalid_token(self):
        """Should raise 401 for invalid tokens."""
        from firebase_admin import auth as firebase_auth

        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="bad-token")

        with patch.object(
            firebase_auth,
            "verify_id_token",
            side_effect=firebase_auth.InvalidIdTokenError("Invalid token"),
        ):
            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(credentials=creds)
            assert exc_info.value.status_code == 401
            assert "Invalid" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_valid_token_student(self):
        """Should return student user for valid non-admin token."""
        from firebase_admin import auth as firebase_auth

        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid-token")

        decoded = {
            "uid": "user-123",
            "email": "student@university.edu",
            "email_verified": True,
            "name": "Student Name",
            "picture": None,
        }

        with patch.object(firebase_auth, "verify_id_token", return_value=decoded):
            with patch("app.middleware.auth.get_settings") as mock_settings:
                settings = MagicMock()
                settings.is_admin_email.return_value = False
                mock_settings.return_value = settings

                user = await get_current_user(credentials=creds)

                assert user.uid == "user-123"
                assert user.email == "student@university.edu"
                assert user.role == "student"
                assert user.is_admin is False
                assert user.display_name == "Student Name"

    @pytest.mark.asyncio
    async def test_valid_token_admin(self):
        """Should return admin user for whitelisted email."""
        from firebase_admin import auth as firebase_auth

        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid-admin-token")

        decoded = {
            "uid": "admin-456",
            "email": "qsmceoglvn@gmail.com",
            "email_verified": True,
            "name": "Admin User",
        }

        with patch.object(firebase_auth, "verify_id_token", return_value=decoded):
            with patch("app.middleware.auth.get_settings") as mock_settings:
                settings = MagicMock()
                settings.is_admin_email.return_value = True
                mock_settings.return_value = settings

                user = await get_current_user(credentials=creds)

                assert user.uid == "admin-456"
                assert user.email == "qsmceoglvn@gmail.com"
                assert user.role == "admin"
                assert user.is_admin is True


class TestRequireAdmin:
    """Test the require_admin dependency."""

    @pytest.mark.asyncio
    async def test_admin_allowed(self):
        """Admin user should pass the check."""
        admin = AuthenticatedUser(uid="1", email="admin@test.com", role="admin")
        result = await require_admin(user=admin)
        assert result.is_admin is True

    @pytest.mark.asyncio
    async def test_student_forbidden(self):
        """Student user should get 403."""
        student = AuthenticatedUser(uid="2", email="student@test.com", role="student")
        with pytest.raises(HTTPException) as exc_info:
            await require_admin(user=student)
        assert exc_info.value.status_code == 403
        assert "Admin access required" in exc_info.value.detail
