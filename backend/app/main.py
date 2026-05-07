"""Galvaniy Labs Backend — FastAPI Application Entry Point."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import health, auth, reports, admin, lab


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    # Startup: initialize Firebase (lazy — only if credentials available)
    settings = get_settings()
    if settings.google_application_credentials:
        from app.dependencies import init_firebase
        init_firebase()
    yield
    # Shutdown: cleanup if needed


def create_app() -> FastAPI:
    """Application factory."""
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="Backend API for Galvaniy Labs — AI-powered lab report generation",
        lifespan=lifespan,
    )

    # CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from app.routers import health, auth, reports, admin, lab, assistant, multiplayer
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(reports.router)
    app.include_router(admin.router)
    app.include_router(lab.router)
    app.include_router(assistant.router)
    app.include_router(multiplayer.router)

    return app


app = create_app()
