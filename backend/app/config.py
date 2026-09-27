"""Galvaniy Labs Backend — Configuration."""

from pydantic import ConfigDict
from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Gemini API — rotational keys (Smartify pattern)
    gemini_api_key: str = ""
    gemini_api_key1: str = ""
    gemini_api_key2: str = ""
    gemini_api_key3: str = ""
    gemini_api_key4: str = ""
    gemini_api_key5: str = ""
    gemini_api_key6: str = ""

    # Custom API fallback
    custom_api_url: str = ""
    ai_priority: str = "gemini"  # "gemini" or "custom"

    # Google OAuth (Global Orators project credentials)
    google_client_id: str = "664033502342-9sijfg71v3c0i0riah1hhhgdufalfvk5.apps.googleusercontent.com"
    google_client_secret: str = "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"

    # Firebase
    google_application_credentials: str = ""

    # CORS
    cors_origins: str = "http://localhost:3000"

    # Server
    port: int = 8001

    # Admin emails (comma-separated)
    admin_emails: str = "qsmceoglvn@gmail.com"

    # App metadata
    app_name: str = "Galvaniy Labs API"
    app_version: str = "1.0.0"

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def admin_emails_list(self) -> List[str]:
        """Parse comma-separated admin emails into a list."""
        return [email.strip().lower() for email in self.admin_emails.split(",") if email.strip()]

    @property
    def all_api_keys(self) -> List[str]:
        """Return all valid Gemini API keys for rotational use."""
        candidates = [
            self.gemini_api_key,
            self.gemini_api_key1,
            self.gemini_api_key2,
            self.gemini_api_key3,
            self.gemini_api_key4,
            self.gemini_api_key5,
            self.gemini_api_key6,
        ]
        return [k.strip() for k in candidates if k and len(k.strip()) > 10]

    def is_admin_email(self, email: str) -> bool:
        """Check if an email is in the admin whitelist or contains 'admin'."""
        if not email:
            return False
        email_lower = email.lower()
        if "admin" in email_lower:
            return True
        return email_lower in self.admin_emails_list


def get_settings() -> Settings:
    """Factory function to create Settings instance.
    
    Loads .env from the backend directory regardless of where
    the process is started from.
    """
    # Resolve the path to the .env file relative to this config file
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(backend_dir, ".env")
    
    return Settings(_env_file=env_path if os.path.exists(env_path) else None)
