"""Tests for Stage 5: API Endpoints (Routers)."""

import os
import sys
import json
import pytest
from unittest.mock import patch, MagicMock, AsyncMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.middleware.auth import AuthenticatedUser, get_current_user, require_admin


# ==================== Helpers ====================

def _mock_student():
    return AuthenticatedUser(uid="student-1", email="student@test.com", role="student")


def _mock_admin():
    return AuthenticatedUser(uid="admin-1", email="admin@test.com", role="admin")


# ==================== Health ====================

class TestHealthRouter:
    @pytest.mark.asyncio
    async def test_health(self, client):
        response = await client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


# ==================== Auth ====================

class TestAuthRouter:
    @pytest.mark.asyncio
    async def test_me_unauthenticated(self, client):
        """Should return 401 without token."""
        response = await client.get("/api/auth/me")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_me_authenticated(self, app, client):
        """Should return user profile for authenticated user."""
        from app.models.user import UserProfile

        mock_profile = UserProfile(
            uid="student-1",
            email="student@test.com",
            role="student",
            reports_generated=5,
        )

        # Override the dependency at the app level
        app.dependency_overrides[get_current_user] = lambda: _mock_student()

        with patch("app.routers.auth.firestore_service") as mock_fs:
            mock_fs.get_user_profile = AsyncMock(return_value=mock_profile)

            response = await client.get("/api/auth/me")
            assert response.status_code == 200
            data = response.json()
            assert data["uid"] == "student-1"
            assert data["reports_generated"] == 5

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_profile_create(self, app, client):
        """Should create profile on first login."""
        app.dependency_overrides[get_current_user] = lambda: _mock_student()

        with patch("app.routers.auth.firestore_service") as mock_fs:
            mock_fs.get_user_profile = AsyncMock(return_value=None)
            mock_fs.create_user_profile = AsyncMock()

            response = await client.post("/api/auth/profile")
            assert response.status_code == 200
            data = response.json()
            assert data["uid"] == "student-1"
            mock_fs.create_user_profile.assert_called_once()

        app.dependency_overrides.clear()


# ==================== Reports ====================

class TestReportsRouter:
    @pytest.mark.asyncio
    async def test_generate_unauthenticated(self, client):
        """Should return 401 without token."""
        response = await client.post(
            "/api/reports/generate",
            json={"experiment_code": "A-2"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_generate_empty_code(self, app, client):
        """Should reject empty experiment code."""
        app.dependency_overrides[get_current_user] = lambda: _mock_student()

        response = await client.post(
            "/api/reports/generate",
            json={"experiment_code": ""},
        )
        assert response.status_code == 422  # Validation error

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_generate_no_manual(self, app, client):
        """Should return 400 when no manual is uploaded."""
        from app.models.user import UserProfile
        from app.models.settings import GlobalSettings

        mock_profile = UserProfile(uid="student-1", email="student@test.com")
        app.dependency_overrides[get_current_user] = lambda: _mock_student()

        with patch("app.routers.reports.firestore_service") as mock_fs:
            mock_fs.get_user_profile = AsyncMock(return_value=mock_profile)
            mock_fs.get_settings = AsyncMock(return_value=GlobalSettings())
            mock_fs.get_manual_pages = AsyncMock(return_value=[])

            with patch("app.utils.rate_limiter.check_rate_limit", return_value=True):
                response = await client.post(
                    "/api/reports/generate",
                    json={"experiment_code": "A-2"},
                )
                assert response.status_code == 400
                assert "manual" in response.json()["detail"].lower()

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_generate_rate_limited(self, app, client):
        """Should return 429 when rate limit exceeded."""
        from app.models.user import UserProfile
        from app.models.settings import GlobalSettings

        mock_profile = UserProfile(uid="student-1", email="student@test.com", custom_limit=0)
        app.dependency_overrides[get_current_user] = lambda: _mock_student()

        with patch("app.routers.reports.firestore_service") as mock_fs:
            mock_fs.get_user_profile = AsyncMock(return_value=mock_profile)
            mock_fs.get_settings = AsyncMock(return_value=GlobalSettings())

            with patch("app.utils.rate_limiter.check_rate_limit", return_value=False):
                response = await client.post(
                    "/api/reports/generate",
                    json={"experiment_code": "A-2"},
                )
                assert response.status_code == 429

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_list_reports(self, app, client):
        """Should return user's reports."""
        from app.models.report import Report

        mock_reports = [
            Report(id="r1", experiment_code="A-2", date="2026-01-01", content="{}", user_uid="student-1"),
        ]

        app.dependency_overrides[get_current_user] = lambda: _mock_student()

        with patch("app.routers.reports.firestore_service") as mock_fs:
            mock_fs.get_user_reports = AsyncMock(return_value=mock_reports)

            response = await client.get("/api/reports")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["experiment_code"] == "A-2"

        app.dependency_overrides.clear()


# ==================== Admin ====================

class TestAdminRouter:
    @pytest.mark.asyncio
    async def test_users_unauthenticated(self, client):
        """Should return 401 without token."""
        response = await client.get("/api/admin/users")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_users_student_forbidden(self, app, client):
        """Should return 403 for non-admin."""
        from fastapi import HTTPException

        def mock_require_admin_fail():
            raise HTTPException(status_code=403, detail="Admin access required.")

        app.dependency_overrides[require_admin] = mock_require_admin_fail

        response = await client.get("/api/admin/users")
        assert response.status_code == 403

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_list_users_admin(self, app, client):
        """Should return users list for admin."""
        from app.models.user import UserProfile

        mock_users = [
            UserProfile(uid="u1", email="s1@test.com", role="student"),
            UserProfile(uid="u2", email="s2@test.com", role="student"),
        ]

        app.dependency_overrides[require_admin] = lambda: _mock_admin()

        with patch("app.routers.admin.firestore_service") as mock_fs:
            mock_fs.get_all_users = AsyncMock(return_value=mock_users)

            response = await client.get("/api/admin/users")
            assert response.status_code == 200
            assert len(response.json()) == 2

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_update_user(self, app, client):
        """Should update user profile."""
        app.dependency_overrides[require_admin] = lambda: _mock_admin()

        with patch("app.routers.admin.firestore_service") as mock_fs:
            mock_fs.update_user_profile = AsyncMock()

            response = await client.patch(
                "/api/admin/users/u1",
                json={"custom_limit": 10, "is_revoked": False},
            )
            assert response.status_code == 200
            assert response.json()["status"] == "updated"

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_get_stats(self, app, client):
        """Should return admin stats."""
        from app.models.settings import AdminStats

        mock_stats = AdminStats(total_students=10, total_reports=50, active_students=8, revoked_students=2)

        app.dependency_overrides[require_admin] = lambda: _mock_admin()

        with patch("app.routers.admin.firestore_service") as mock_fs:
            mock_fs.get_admin_stats = AsyncMock(return_value=mock_stats)

            response = await client.get("/api/admin/stats")
            assert response.status_code == 200
            data = response.json()
            assert data["total_students"] == 10
            assert data["revoked_students"] == 2

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_get_settings(self, app, client):
        """Should return global settings."""
        from app.models.settings import GlobalSettings

        mock_settings = GlobalSettings(default_daily_limit=5, api_provider="custom")

        app.dependency_overrides[require_admin] = lambda: _mock_admin()

        with patch("app.routers.admin.firestore_service") as mock_fs:
            mock_fs.get_settings = AsyncMock(return_value=mock_settings)

            response = await client.get("/api/admin/settings")
            assert response.status_code == 200
            data = response.json()
            assert data["default_daily_limit"] == 5

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_update_settings(self, app, client):
        """Should update settings."""
        app.dependency_overrides[require_admin] = lambda: _mock_admin()

        with patch("app.routers.admin.firestore_service") as mock_fs:
            mock_fs.update_settings = AsyncMock()

            response = await client.put(
                "/api/admin/settings",
                json={"default_daily_limit": 10},
            )
            assert response.status_code == 200

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_clear_manual(self, app, client):
        """Should clear the manual."""
        app.dependency_overrides[require_admin] = lambda: _mock_admin()

        with patch("app.routers.admin.firestore_service") as mock_fs:
            mock_fs.clear_manual = AsyncMock()

            response = await client.delete("/api/admin/manual")
            assert response.status_code == 200
            assert response.json()["status"] == "manual_cleared"

        app.dependency_overrides.clear()
