"""Shared test fixtures for Galvaniy Labs backend tests."""

import sys
import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

# Ensure the backend directory is on the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture
def app():
    """Create a fresh FastAPI app instance for testing."""
    # Override settings for testing
    os.environ["GEMINI_API_KEY"] = "test-key-12345"
    os.environ["CORS_ORIGINS"] = "http://localhost:3000"
    os.environ["PORT"] = "8001"
    os.environ["ADMIN_EMAILS"] = "admin@test.com,qsmceoglvn@gmail.com"

    from app.main import create_app
    return create_app()


@pytest_asyncio.fixture
async def client(app):
    """Create an async HTTP test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
