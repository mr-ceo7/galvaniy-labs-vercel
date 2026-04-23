"""Tests for Stage 1: Configuration, app setup, and health endpoint."""

import os
import sys
import pytest

# Ensure backend is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestConfig:
    """Test the Settings configuration class."""

    def test_settings_defaults(self):
        """Settings should have sensible defaults."""
        os.environ.pop("GEMINI_API_KEY", None)
        os.environ.pop("CORS_ORIGINS", None)
        os.environ.pop("PORT", None)
        os.environ.pop("ADMIN_EMAILS", None)

        from app.config import Settings
        settings = Settings(
            _env_file=None,
            gemini_api_key="test-key",
            cors_origins="http://localhost:3000",
            port=8001,
            admin_emails="admin@test.com",
        )
        assert settings.app_name == "Galvaniy Labs API"
        assert settings.app_version == "1.0.0"
        assert settings.port == 8001

    def test_cors_origins_parsing(self):
        """CORS origins string should be parsed into a list."""
        from app.config import Settings
        settings = Settings(
            _env_file=None,
            gemini_api_key="test",
            cors_origins="http://localhost:3000, https://example.com",
        )
        origins = settings.cors_origins_list
        assert origins == ["http://localhost:3000", "https://example.com"]

    def test_cors_origins_single(self):
        """Single CORS origin should still produce a list."""
        from app.config import Settings
        settings = Settings(
            _env_file=None,
            gemini_api_key="test",
            cors_origins="http://localhost:3000",
        )
        assert settings.cors_origins_list == ["http://localhost:3000"]

    def test_admin_emails_parsing(self):
        """Admin emails should be parsed and lowercased."""
        from app.config import Settings
        settings = Settings(
            _env_file=None,
            gemini_api_key="test",
            admin_emails="Admin@Test.com, user@EXAMPLE.com",
        )
        assert settings.admin_emails_list == ["admin@test.com", "user@example.com"]

    def test_is_admin_email_whitelist(self):
        """Whitelisted emails should be recognized as admin."""
        from app.config import Settings
        settings = Settings(
            _env_file=None,
            gemini_api_key="test",
            admin_emails="qsmceoglvn@gmail.com",
        )
        assert settings.is_admin_email("qsmceoglvn@gmail.com") is True
        assert settings.is_admin_email("QSMCEOGLVN@gmail.com") is True
        assert settings.is_admin_email("random@gmail.com") is False

    def test_is_admin_email_contains_admin(self):
        """Emails containing 'admin' should be treated as admin."""
        from app.config import Settings
        settings = Settings(
            _env_file=None,
            gemini_api_key="test",
            admin_emails="other@test.com",
        )
        assert settings.is_admin_email("admin@university.edu") is True
        assert settings.is_admin_email("superadmin@test.com") is True

    def test_is_admin_email_empty(self):
        """Empty email should not be admin."""
        from app.config import Settings
        settings = Settings(
            _env_file=None,
            gemini_api_key="test",
        )
        assert settings.is_admin_email("") is False


class TestHealthEndpoint:
    """Test the /api/health endpoint."""

    @pytest.mark.asyncio
    async def test_health_returns_200(self, client):
        """Health endpoint should return 200 OK."""
        response = await client.get("/api/health")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_health_response_body(self, client):
        """Health response should contain status, app name, and version."""
        response = await client.get("/api/health")
        data = response.json()
        assert data["status"] == "healthy"
        assert "app" in data
        assert "version" in data

    @pytest.mark.asyncio
    async def test_health_app_name(self, client):
        """Health should return the correct app name."""
        response = await client.get("/api/health")
        data = response.json()
        assert data["app"] == "Galvaniy Labs API"


class TestAppCreation:
    """Test the FastAPI app factory."""

    def test_app_has_routes(self, app):
        """App should have registered routes."""
        routes = [route.path for route in app.routes]
        assert "/api/health" in routes

    def test_app_title(self, app):
        """App should have the correct title."""
        assert app.title == "Galvaniy Labs API"
