"""Tests for Stage 3: Models and Firestore Service."""

import os
import sys
import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestUserModels:
    """Test User Pydantic models."""

    def test_user_profile_defaults(self):
        from app.models.user import UserProfile
        user = UserProfile(uid="abc", email="test@test.com")
        assert user.role == "student"
        assert user.is_revoked is False
        assert user.reports_generated == 0
        assert user.custom_limit is None

    def test_user_profile_full(self):
        from app.models.user import UserProfile
        user = UserProfile(
            uid="abc",
            email="admin@test.com",
            role="admin",
            display_name="Admin",
            custom_limit=10,
            is_revoked=False,
            reports_generated=5,
        )
        assert user.role == "admin"
        assert user.custom_limit == 10
        assert user.reports_generated == 5

    def test_user_profile_update(self):
        from app.models.user import UserProfileUpdate
        update = UserProfileUpdate(custom_limit=5, is_revoked=True)
        assert update.custom_limit == 5
        assert update.is_revoked is True
        assert update.role is None

    def test_user_response(self):
        from app.models.user import UserResponse
        resp = UserResponse(uid="1", email="x@y.com", role="student")
        assert resp.uid == "1"
        assert resp.is_revoked is False


class TestReportModels:
    """Test Report Pydantic models."""

    def test_generate_request_valid(self):
        from app.models.report import ReportGenerateRequest
        req = ReportGenerateRequest(experiment_code="A-2")
        assert req.experiment_code == "A-2"

    def test_generate_request_empty_fails(self):
        from app.models.report import ReportGenerateRequest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            ReportGenerateRequest(experiment_code="")

    def test_generate_request_too_long_fails(self):
        from app.models.report import ReportGenerateRequest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            ReportGenerateRequest(experiment_code="A" * 51)

    def test_report_response(self):
        from app.models.report import ReportResponse
        resp = ReportResponse(id="1", experiment_code="B-3", date="2026-01-01", content="{}")
        assert resp.experiment_code == "B-3"

    def test_report_model(self):
        from app.models.report import Report
        report = Report(id="r1", experiment_code="C-1", date="2026-01-01", content="{}", user_uid="u1")
        assert report.user_uid == "u1"


class TestSettingsModels:
    """Test Settings Pydantic models."""

    def test_global_settings_defaults(self):
        from app.models.settings import GlobalSettings
        settings = GlobalSettings()
        assert settings.default_daily_limit == 3
        assert settings.api_provider == "gemini"
        assert settings.enable_parallel_generation is True

    def test_admin_stats(self):
        from app.models.settings import AdminStats
        stats = AdminStats(total_students=10, total_reports=50, active_students=8, revoked_students=2)
        assert stats.total_students == 10
        assert stats.revoked_students == 2


class TestManualModels:
    """Test Manual Pydantic models."""

    def test_manual_page(self):
        from app.models.manual import ManualPage
        page = ManualPage(id="p1", page_number=1, text="Hello world")
        assert page.page_number == 1
        assert page.image is None

    def test_manual_metadata(self):
        from app.models.manual import ManualMetadata
        meta = ManualMetadata(name="Physics Manual 2026", page_count=50)
        assert meta.version == 1
        assert meta.page_count == 50


class TestFirestoreService:
    """Test FirestoreService with mocked Firestore client."""

    def _make_service(self):
        from app.services.firestore_service import FirestoreService
        mock_db = MagicMock()
        return FirestoreService(db=mock_db), mock_db

    @pytest.mark.asyncio
    async def test_get_settings_default(self):
        """Should return defaults when no doc exists."""
        service, mock_db = self._make_service()
        mock_doc = MagicMock()
        mock_doc.exists = False
        mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

        result = await service.get_settings()
        assert result.default_daily_limit == 3
        assert result.api_provider == "gemini"

    @pytest.mark.asyncio
    async def test_get_settings_from_firestore(self):
        """Should read settings from Firestore doc."""
        service, mock_db = self._make_service()
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "defaultDailyLimit": 5,
            "customInstructions": "Be detailed",
            "apiProvider": "custom",
            "customApiUrl": "http://api.test.com",
            "enableParallelGeneration": False,
            "updatedBy": "admin@test.com",
        }
        mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

        result = await service.get_settings()
        assert result.default_daily_limit == 5
        assert result.api_provider == "custom"
        assert result.custom_api_url == "http://api.test.com"
        assert result.enable_parallel_generation is False

    @pytest.mark.asyncio
    async def test_get_user_profile_not_found(self):
        """Should return None when user doesn't exist."""
        service, mock_db = self._make_service()
        mock_doc = MagicMock()
        mock_doc.exists = False
        mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

        result = await service.get_user_profile("nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_user_profile_found(self):
        """Should return UserProfile from Firestore."""
        service, mock_db = self._make_service()
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "uid": "user-1",
            "email": "student@test.com",
            "role": "student",
            "isRevoked": False,
            "reportsGenerated": 3,
            "customLimit": 5,
        }
        mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

        result = await service.get_user_profile("user-1")
        assert result is not None
        assert result.uid == "user-1"
        assert result.email == "student@test.com"
        assert result.reports_generated == 3
        assert result.custom_limit == 5

    @pytest.mark.asyncio
    async def test_create_user_profile(self):
        """Should write user profile to Firestore."""
        from app.models.user import UserProfile
        service, mock_db = self._make_service()

        profile = UserProfile(uid="new-user", email="new@test.com", role="student")
        await service.create_user_profile(profile)

        mock_db.collection.return_value.document.return_value.set.assert_called_once()
        call_data = mock_db.collection.return_value.document.return_value.set.call_args[0][0]
        assert call_data["uid"] == "new-user"
        assert call_data["email"] == "new@test.com"

    @pytest.mark.asyncio
    async def test_update_user_profile(self):
        """Should update specific fields."""
        service, mock_db = self._make_service()

        await service.update_user_profile("user-1", {"custom_limit": 10, "is_revoked": True})

        mock_db.collection.return_value.document.return_value.update.assert_called_once()
        call_data = mock_db.collection.return_value.document.return_value.update.call_args[0][0]
        assert call_data["customLimit"] == 10
        assert call_data["isRevoked"] is True

    @pytest.mark.asyncio
    async def test_get_manual_metadata_none(self):
        """Should return None when no manual uploaded."""
        service, mock_db = self._make_service()
        mock_doc = MagicMock()
        mock_doc.exists = False
        mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

        result = await service.get_manual_metadata()
        assert result is None

    @pytest.mark.asyncio
    async def test_save_report(self):
        """Should save report to Firestore."""
        from app.models.report import Report
        service, mock_db = self._make_service()

        report = Report(id="r1", experiment_code="A-2", date="2026-01-01", content="{}", user_uid="u1")
        await service.save_report("u1", report)

        mock_db.collection.return_value.document.return_value.set.assert_called_once()
        call_data = mock_db.collection.return_value.document.return_value.set.call_args[0][0]
        assert call_data["experimentCode"] == "A-2"
        assert call_data["userUid"] == "u1"

    @pytest.mark.asyncio
    async def test_get_admin_stats_empty(self):
        """Should return zeroed stats with no users."""
        service, mock_db = self._make_service()
        mock_db.collection.return_value.get.return_value = []

        stats = await service.get_admin_stats()
        assert stats.total_students == 0
        assert stats.total_reports == 0
