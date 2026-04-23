"""Galvaniy Labs Backend — Shared Dependencies.

Provides singleton instances of Firebase Admin SDK and Gemini client.
"""

import firebase_admin
from firebase_admin import credentials, firestore, auth as firebase_auth
from google import genai
from app.config import get_settings

# Module-level singletons
_firestore_client = None
_gemini_client = None
_firebase_app = None


def init_firebase() -> None:
    """Initialize Firebase Admin SDK (idempotent).
    
    Tries to use GOOGLE_APPLICATION_CREDENTIALS env var for the
    service account JSON. Falls back to Application Default Credentials.
    """
    global _firebase_app
    if _firebase_app is not None:
        return

    settings = get_settings()

    try:
        if settings.google_application_credentials:
            cred = credentials.Certificate(settings.google_application_credentials)
            _firebase_app = firebase_admin.initialize_app(cred)
        else:
            # Use Application Default Credentials or fall back
            _firebase_app = firebase_admin.initialize_app()
    except ValueError:
        # Already initialized (e.g., in tests)
        _firebase_app = firebase_admin.get_app()


def get_firestore_client():
    """Get or create the Firestore client."""
    global _firestore_client
    if _firestore_client is None:
        init_firebase()
        _firestore_client = firestore.client()
    return _firestore_client


def get_gemini_client() -> genai.Client:
    """Get or create the Gemini AI client."""
    global _gemini_client
    if _gemini_client is None:
        settings = get_settings()
        _gemini_client = genai.Client(api_key=settings.gemini_api_key)
    return _gemini_client


def reset_clients() -> None:
    """Reset all singleton clients (used in testing)."""
    global _firestore_client, _gemini_client, _firebase_app
    _firestore_client = None
    _gemini_client = None
    _firebase_app = None
